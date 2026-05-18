import { createFileRoute } from "@tanstack/react-router";
import {
	consumeStream,
	convertToModelMessages,
	stepCountIs,
	streamText,
} from "ai";
import { randomUUID } from "node:crypto";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { useRequest } from "nitro/context";
import type { RequestLogger } from "evlog";
import { createChatTools, tripwireTools } from "@tripwire/tools";
import { logCreditUsageError, trackCreditUsage } from "@tripwire/ai/credit-middleware";
import { computeCostCents } from "@tripwire/ai/credit-schema";
import { buildSystemPrompt } from "@tripwire/ai";
import { createContext, assertRepoOwner } from "#/integrations/trpc/init";
import { autumn } from "@tripwire/auth/autumn";
import { db } from "@tripwire/db/client";
import { conversations, organizations, repositories } from "@tripwire/db";
import { and, eq } from "drizzle-orm";
import type { ProviderError } from "#/types/chat";
import {
	mergeClientMessagesWithStored,
	sanitizeMessages,
} from "#/lib/chat-server";
import { checkRateLimit } from "@tripwire/ratelimit";

const MAX_CHAT_INPUT_CHARS = 40_000;
const MAX_CHAT_ITERATIONS = 6;
const MAX_CHAT_OUTPUT_TOKENS = 1_024;
const TOKEN_ESTIMATE_CHARS = 4;
const CHAT_PROMPT_TOKEN_BUFFER = 8_000;
const MIN_CHAT_RESERVATION_CENTS = 100;

function getRequestLog(): RequestLogger | undefined {
	try {
		const req = useRequest() as { context?: { log?: RequestLogger } } | undefined;
		return req?.context?.log;
	} catch {
		return undefined;
	}
}

async function resolveRepoIdForUser(userId: string): Promise<string | undefined> {
	const userOrgs = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.ownerId, userId));

	for (const org of userOrgs) {
		const [firstRepo] = await db
			.select({ id: repositories.id })
			.from(repositories)
			.where(eq(repositories.orgId, org.id))
			.limit(1);
		if (firstRepo?.id) return firstRepo.id;
	}
	return undefined;
}

function jsonError(status: number, body: Record<string, unknown>, extraHeaders?: Record<string, string>) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...extraHeaders },
	});
}

async function checkQuota(
	userId: string,
	lockId: string,
	requiredBalance: number,
) {
	const checkParams = {
		customerId: userId,
		featureId: "ai_credits",
		requiredBalance,
		withPreview: true,
		lock: {
			lockId,
			enabled: true as const,
			expiresAt: Date.now() + 10 * 60 * 1000,
		},
	};
	try {
		return await autumn.check(checkParams);
	} catch (checkErr: any) {
		const isNotFound = checkErr?.statusCode === 404
			|| checkErr?.code === "customer_not_found"
			|| checkErr?.body?.code === "customer_not_found"
			|| String(checkErr?.message).includes("not found");
		if (!isNotFound) throw checkErr;
		await autumn.customers.getOrCreate({ customerId: userId });
		return autumn.check(checkParams);
	}
}

async function estimateReservedCreditCents(modelId: string, rawMessages: unknown) {
	const serialized = JSON.stringify(rawMessages ?? []);
	const estimatedPromptTokens = Math.ceil(serialized.length / TOKEN_ESTIMATE_CHARS) + CHAT_PROMPT_TOKEN_BUFFER;
	const estimatedCompletionTokens = MAX_CHAT_ITERATIONS * MAX_CHAT_OUTPUT_TOKENS;
	const estimatedCost = await computeCostCents(
		modelId,
		estimatedPromptTokens,
		estimatedCompletionTokens,
	);
	return Math.max(MIN_CHAT_RESERVATION_CENTS, estimatedCost);
}

async function releaseQuotaLock(lockId: string) {
	try {
		await autumn.balances.finalize({ lockId, action: "release" });
	} catch (err) {
		console.error("[chat] Failed to release quota lock:", err);
	}
}

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const ctx = await createContext({ headers: request.headers });
				if (!ctx.user) return jsonError(401, { error: "Unauthorized" });
				const user = ctx.user;
				let quotaLockId: string | undefined;

				try {
					const { messages: rawMessages, repoId, conversationId, currentPage } = await request.json();
					await checkRateLimit("chat", `user:${user.id}`);

					const serializedMessages = JSON.stringify(rawMessages ?? []);
					if (!Array.isArray(rawMessages) || serializedMessages.length > MAX_CHAT_INPUT_CHARS) {
						return jsonError(400, {
							error: "chat_input_too_large",
							message: "Chat input is too large. Start a new thread or shorten the request.",
						});
					}

					const aiModel = process.env.TRIPWIRE_AI_MODEL || "openai/gpt-5.4";

					// If the client supplied a conversationId AND a row already exists for it,
					// verify the row belongs to this user. Without this check the endpoint
					// trusts the body, so a user could attach their messages to someone else's
					// chat. New chats race with trpc.chats.create so the row may not exist
					// yet; only block when the row exists and is owned by a different user.
					let existingConversation: { userId: string; repoId: string | null; messages: any[] } | undefined;
					if (conversationId && typeof conversationId === "string") {
						const [existing] = await db
							.select({
								userId: conversations.userId,
								repoId: conversations.repoId,
								messages: conversations.messages,
							})
							.from(conversations)
							.where(eq(conversations.id, conversationId))
							.limit(1);
						existingConversation = existing;
						if (existing && existing.userId !== user.id) {
							return jsonError(403, { error: "conversation_not_accessible" });
						}
					}

					const resolvedRepoId = existingConversation?.repoId
						?? (repoId as string | undefined)
						?? await resolveRepoIdForUser(user.id);

					if (!resolvedRepoId) {
						return jsonError(400, {
							error: "No repositories available. Connect a repository to start chatting.",
						});
					}

					try {
						await assertRepoOwner(user.id, resolvedRepoId);
					} catch {
						return jsonError(403, { error: "repo_not_accessible" });
					}

					quotaLockId = `chat:${user.id}:${randomUUID()}`;
					let quota: any;
					try {
						const reservedCredits = await estimateReservedCreditCents(aiModel, rawMessages);
						quota = await checkQuota(user.id, quotaLockId, reservedCredits);
					} catch (checkErr) {
						// Autumn down/misconfigured: fail closed rather than grant free credits.
						console.error("[Tripwire] Autumn check failed, denying request:", checkErr);
						if (quotaLockId) void releaseQuotaLock(quotaLockId);
						return jsonError(429, {
							error: "quota_check_failed",
							code: "quota_check_failed",
							message: "Could not verify your AI credits. Try again shortly.",
						});
					}

					if (!quota?.allowed) {
						const code = quota?.preview?.scenario ?? "usage_limit";
						return jsonError(429, {
							error: "quota_exhausted",
							code,
							message: code === "usage_limit"
								? "You've used all your AI credits this month."
								: "AI chat is not included in your current plan.",
						}, { "X-Quota-Code": code });
					}

					const [repo] = await db
						.select()
						.from(repositories)
						.where(eq(repositories.id, resolvedRepoId))
						.limit(1);

					const systemPrompt = buildSystemPrompt({
						repoName: repo?.fullName ?? "Unknown Repository",
						userName: user.name ?? user.email ?? "User",
						currentPage: currentPage ?? "/home",
					});

					getRequestLog()?.set({
						ai: {
							model: aiModel,
							conversationId,
							repoId: resolvedRepoId,
							currentPage: currentPage ?? "/home",
						},
					});

					const tools = createChatTools(
						{
							userId: user.id,
							userName: user.name ?? user.email ?? "User",
							repoId: resolvedRepoId,
						},
						tripwireTools,
					);

					const mergedMessages = mergeClientMessagesWithStored(
						Array.isArray(rawMessages) ? rawMessages : [],
						existingConversation?.messages ?? [],
					);

					if (typeof conversationId === "string" && existingConversation) {
						await db
							.update(conversations)
							.set({ messages: mergedMessages, updatedAt: new Date() })
							.where(
								and(
									eq(conversations.id, conversationId),
									eq(conversations.userId, user.id),
								),
							)
							.catch((err) => {
								console.error("[chat] Failed to persist approval cleanup:", err);
							});
					}

					const messages = sanitizeMessages(mergedMessages, tools);
					const modelMessages = await convertToModelMessages(
						messages.map(({ id: _id, ...message }) => message),
						{ tools, ignoreIncompleteToolCalls: true },
					);

					if (process.env.NODE_ENV !== "production") {
						const summary = messages.map((m: any, i: number) => {
							const parts = m.parts?.map((p: any) => {
								const id = p.toolCallId || p.id;
								const idStr = id ? `(${String(id).slice(0, 8)})` : "";
								const nameStr = p.name ? `:${p.name}` : "";
								const stateStr = p.state ? `[${p.state}]` : "";
								return `${p.type}${idStr}${nameStr}${stateStr}`;
							}).join(", ") ?? "no-parts";
							return `  [${i}] ${m.role}: ${parts}`;
						}).join("\n");
						console.log(`[Chat] ${messages.length} messages:\n${summary}`);
					}

					const openrouter = createOpenRouter({
						apiKey: process.env.OPENROUTER_API_KEY,
						appName: "Tripwire",
						compatibility: "strict",
					});

					const result = streamText({
						model: openrouter.chat(aiModel, {
							plugins: [{ id: "web", max_results: 3 }],
						}),
						messages: modelMessages,
						tools,
						system: systemPrompt,
						stopWhen: stepCountIs(MAX_CHAT_ITERATIONS),
						maxOutputTokens: MAX_CHAT_OUTPUT_TOKENS,
						abortSignal: request.signal,
						onFinish: async ({ totalUsage }) => {
							await trackCreditUsage({
								customerId: user.id,
								modelId: aiModel,
								userName: user.name ?? undefined,
								userEmail: user.email ?? undefined,
								repoId: resolvedRepoId,
								quotaLockId,
								usage: totalUsage,
							});
						},
						onError: ({ error }) => {
							if (quotaLockId) void releaseQuotaLock(quotaLockId);
							logCreditUsageError({
								customerId: user.id,
								modelId: aiModel,
								userName: user.name ?? undefined,
								userEmail: user.email ?? undefined,
								repoId: resolvedRepoId,
								error,
							});
							const err = error as ProviderError;
							const raw = err?.error?.metadata?.raw ?? err?.error?.message ?? err?.message ?? "Unknown";
							console.error("[Chat API stream]", typeof raw === "string" ? raw : JSON.stringify(raw));
						},
					});

					return result.toUIMessageStreamResponse({
						originalMessages: messages,
							messageMetadata: ({ part }) => {
								if (part.type === "finish") {
									return { usage: part.totalUsage, modelId: aiModel };
								}
							return undefined;
						},
						onFinish: async ({ messages: finishedMessages }) => {
							if (typeof conversationId !== "string") return;
							await db
								.insert(conversations)
								.values({
									id: conversationId,
									userId: user.id,
									repoId: resolvedRepoId,
									messages: finishedMessages,
									title: "New chat",
								})
								.onConflictDoUpdate({
									target: conversations.id,
									set: {
										messages: finishedMessages,
										repoId: resolvedRepoId,
										updatedAt: new Date(),
									},
									setWhere: eq(conversations.userId, user.id),
								})
								.catch((err) => {
									console.error("[chat] Failed to persist server stream:", err);
								});
						},
						consumeSseStream: consumeStream,
					});
				} catch (error: any) {
					if (quotaLockId) void releaseQuotaLock(quotaLockId);
					const errMsg = error?.error?.message || error?.message || "Unknown error";
					const provider = error?.error?.metadata?.provider_name;
					const raw = error?.error?.metadata?.raw;
					console.error(
						`[Chat API] ${provider ? provider + ": " : ""}${errMsg}`,
						raw ? `\n${raw}` : "",
					);
					getRequestLog()?.set({
						ai: { outcome: "error", provider, errorMessage: errMsg },
					});
					getRequestLog()?.error(
						error instanceof Error ? error : new Error(errMsg),
					);
					return jsonError(500, { error: errMsg });
				}
			},
		},
	},
});
