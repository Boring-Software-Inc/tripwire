import { createFileRoute } from "@tanstack/react-router";
import {
	chat,
	toServerSentEventsResponse,
	maxIterations,
	type ChatMiddleware,
} from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { webSearchTool } from "@tanstack/ai-openrouter/tools";
import { useRequest } from "nitro/context";
import type { RequestLogger } from "evlog";
import { createChatTools, tripwireTools } from '@tripwire/tools';
import { createCreditMiddleware } from '@tripwire/ai/credit-middleware';
import {
	hashArgs,
	signApprovalToken,
	verifyApprovalToken,
} from '@tripwire/ai';
import { buildSystemPrompt } from '@tripwire/ai';
import { createContext, assertRepoOwner } from "#/integrations/trpc/init";
import { autumn } from '@tripwire/auth/autumn';
import { db } from "@tripwire/db/client";
import { conversations, organizations, repositories } from "@tripwire/db";
import { eq } from "drizzle-orm";
import type { ProviderError } from "#/types/chat";

function getRequestLog(): RequestLogger | undefined {
	try {
		const req = useRequest() as { context?: { log?: RequestLogger } } | undefined;
		return req?.context?.log;
	} catch {
		return undefined;
	}
}

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// Authenticate user
				const ctx = await createContext({ headers: request.headers });
				if (!ctx.user) {
					return new Response(
						JSON.stringify({ error: "Unauthorized" }),
						{ status: 401, headers: { "Content-Type": "application/json" } },
					);
				}

				try {
					// Check AI message quota (auto-create customer if not found)
					let quota: any;
					try {
						quota = await autumn.check({
							customerId: ctx.user.id,
							featureId: "ai_credits",
							withPreview: true,
						});
					} catch (checkErr: any) {
						const isNotFound = checkErr?.statusCode === 404
							|| checkErr?.code === "customer_not_found"
							|| checkErr?.body?.code === "customer_not_found"
							|| String(checkErr?.message).includes("not found");
						if (isNotFound) {
							// Existing user without Autumn record, create and retry
							await autumn.customers.getOrCreate({ customerId: ctx.user.id });
							quota = await autumn.check({
								customerId: ctx.user.id,
								featureId: "ai_credits",
								withPreview: true,
							});
						} else {
							// Autumn is down or misconfigured. Fail closed: don't grant
							// free AI credits when we can't verify quota.
							console.error("[Tripwire] Autumn check failed, denying request:", checkErr);
							return new Response(
								JSON.stringify({
									error: "quota_check_failed",
									code: "quota_check_failed",
									message: "Could not verify your AI credits. Try again shortly.",
								}),
								{
									status: 429,
									headers: { "Content-Type": "application/json" },
								},
							);
						}
					}

					if (!quota?.allowed) {
						const code = quota?.code ?? "usage_limit";
						return new Response(
							JSON.stringify({
								error: "quota_exhausted",
								code,
								message: code === "usage_limit"
									? "You've used all your AI credits this month."
									: "AI chat is not included in your current plan.",
							}),
							{
								status: 429,
								headers: {
									"Content-Type": "application/json",
									"X-Quota-Code": code,
								},
							},
						);
					}

					const { messages: rawMessages, repoId, conversationId, currentPage } = await request.json();

					// If the client supplied a conversationId AND a row already exists
					// for it, verify the row belongs to this user. Without this check
					// the endpoint trusts the request body, so a user could attach
					// their message history to someone else's chat (or scrape ids).
					// Note: the first send for a new chat races with trpc.chats.create
					// so the row may legitimately not exist yet — only block when the
					// row exists and is owned by a different user.
					if (conversationId && typeof conversationId === "string") {
						const [existing] = await db
							.select({ userId: conversations.userId })
							.from(conversations)
							.where(eq(conversations.id, conversationId))
							.limit(1);
						if (existing && existing.userId !== ctx.user.id) {
							return new Response(
								JSON.stringify({ error: "conversation_not_accessible" }),
								{ status: 403, headers: { "Content-Type": "application/json" } },
							);
						}
					}

					// We intentionally run executeApprovedTools BEFORE sanitizeMessages.
					// sanitize strips tool-calls that don't have a paired tool-result in
					// the same message (Pass 3 / Pass 4) — but for an approval-responded
					// tool-call the result doesn't exist yet; executeApprovedTools is
					// what produces it. If sanitize ran first it would wipe the approved
					// call, leaving nothing for executeApprovedTools to find, and the
					// model would just re-propose the same tool on every iteration. That
					// is the approval-loop bug.
					//
					// So: run executeApprovedTools first to inject results, THEN sanitize.

					let resolvedRepoId = repoId as string | undefined;

					// Backward compatibility for the new UI flow where repo picker was removed:
					// if no repoId is sent, fall back to the first available repo owned by the user.
					if (!resolvedRepoId) {
						const userOrgs = await db
							.select({ id: organizations.id })
							.from(organizations)
							.where(eq(organizations.ownerId, ctx.user.id));

						for (const org of userOrgs) {
							const [firstRepo] = await db
								.select({ id: repositories.id })
								.from(repositories)
								.where(eq(repositories.orgId, org.id))
								.limit(1);

							if (firstRepo?.id) {
								resolvedRepoId = firstRepo.id;
								break;
							}
						}
					}

					if (!resolvedRepoId) {
						return new Response(
							JSON.stringify({
								error: "No repositories available. Connect a repository to start chatting.",
							}),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}

					try {
						await assertRepoOwner(ctx.user.id, resolvedRepoId);
					} catch {
						return new Response(
							JSON.stringify({ error: "repo_not_accessible" }),
							{ status: 403, headers: { "Content-Type": "application/json" } },
						);
					}

					// Get repo info for context
					const [repo] = await db
						.select()
						.from(repositories)
						.where(eq(repositories.id, resolvedRepoId))
						.limit(1);

					const repoName = repo?.fullName ?? "Unknown Repository";

					// Build system prompt with context
					const systemPrompt = buildSystemPrompt({
						repoName,
						userName: ctx.user.name ?? ctx.user.email ?? "User",
						currentPage: currentPage ?? "/home",
					});

					// Model selection (configurable via env)
					const aiModel = process.env.TRIPWIRE_AI_MODEL || "openai/gpt-5.4";

					// Seed the wide event with chat context — token / cost / outcome
					// fields land on this same event when the credit middleware finishes.
					getRequestLog()?.set({
						ai: {
							model: aiModel,
							conversationId,
							repoId: resolvedRepoId,
							currentPage: currentPage ?? "/home",
						},
					});

					// Create tools with context
					const tools = createChatTools(
						{
							userId: ctx.user.id,
							userName: ctx.user.name ?? ctx.user.email ?? "User",
							repoId: resolvedRepoId,
						},
						tripwireTools,
					);

					// Execute approved tool-calls and inject their results into rawMessages
					// in place. After this, sanitize will see paired call+result and keep
					// them. (See the comment above the sanitize call for the loop bug
					// this ordering avoids.)
					await executeApprovedTools(rawMessages, tools, {
						userId: ctx.user.id,
						conversationId: String(conversationId ?? ""),
						repoId: resolvedRepoId,
					});

					// Now sanitize, with the approved tool-results already in place.
					const messages = sanitizeMessages(rawMessages);

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

					// Credit tracking middleware — accumulates tokens, computes credits, fires autumn.track()
					const creditMiddleware = createCreditMiddleware({
						customerId: ctx.user.id,
						modelId: aiModel,
					});

					// Sign approval-requested chunks so executeApprovedTools can prove
					// the model actually proposed each tool-call before re-running it.
					const approvalSigner = createApprovalSignerMiddleware({
						userId: ctx.user.id,
						conversationId: String(conversationId ?? ""),
						repoId: resolvedRepoId,
					});

					// Create streaming chat response with concise error logging
					// (TanStack AI's default ConsoleLogger uses console.dir with
					// depth:null, dumping entire HTTP response objects on errors)
					const stream = chat({
						adapter: openRouterText(aiModel as Parameters<typeof openRouterText>[0]),
						messages,
						tools: [...tools, webSearchTool({ maxResults: 3 })],
						systemPrompts: [systemPrompt],
						conversationId,
						agentLoopStrategy: maxIterations(10),
						middleware: [approvalSigner, creditMiddleware],
						debug: {
							errors: true,
							provider: false,
							output: false,
							middleware: false,
							tools: false,
							agentLoop: false,
							config: false,
							request: false,
							logger: {
								debug: (msg: string) => console.debug(msg),
								info: (msg: string) => console.info(msg),
								warn: (msg: string) => console.warn(msg),
								error: (msg: string, meta?: Record<string, unknown>) => {
									if (meta?.error) {
										const err = meta.error as ProviderError;
										const raw = err?.error?.metadata?.raw ?? err?.error?.message ?? err?.message ?? "Unknown";
										console.error(msg, typeof raw === "string" ? raw : JSON.stringify(raw));
									} else {
										console.error(msg, meta ?? "");
									}
								},
							},
						},
					});

					// Credit tracking is handled by creditMiddleware (onFinish → ctx.defer)
					return toServerSentEventsResponse(stream);
				} catch (error: any) {
					// Log concise error, not the full stack/object dump
					const errMsg = error?.error?.message
						|| error?.message
						|| "Unknown error";
					const provider = error?.error?.metadata?.provider_name;
					const raw = error?.error?.metadata?.raw;
					console.error(
						`[Chat API] ${provider ? provider + ": " : ""}${errMsg}`,
						raw ? `\n${raw}` : "",
					);
					// Surface on the wide event for Axiom dashboards / drilldowns.
					getRequestLog()?.set({
						ai: { outcome: "error", provider, errorMessage: errMsg },
					});
					getRequestLog()?.error(
						error instanceof Error ? error : new Error(errMsg),
					);
					return new Response(
						JSON.stringify({
							error: errMsg,
						}),
						{ status: 500, headers: { "Content-Type": "application/json" } },
					);
				}
			},
		},
	},
});

interface ApprovalSessionContext {
	userId: string;
	conversationId: string;
	repoId: string;
}

/**
 * ChatMiddleware that intercepts the CUSTOM `approval-requested` chunk
 * emitted by @tanstack/ai when a `needsApproval` tool is proposed by the
 * model. We replace the opaque `approval.id` with an HMAC-signed token
 * that binds {toolCallId, userId, conversationId, repoId, name, argsHash}.
 *
 * The token round-trips through the client as `part.approval.id` and is
 * verified by executeApprovedTools on the next request. A client cannot
 * forge a token (no access to BETTER_AUTH_SECRET), so synthetic
 * "approval-responded" tool-calls are rejected.
 */
function createApprovalSignerMiddleware(
	session: ApprovalSessionContext,
): ChatMiddleware {
	return {
		name: "approval-signer",
		onChunk(_ctx, chunk) {
			if (chunk.type !== "CUSTOM") return;
			if ((chunk as any).name !== "approval-requested") return;
			const value = (chunk as any).value;
			if (!value || typeof value !== "object") return;
			const { toolCallId, toolName, input, approval } = value;
			if (!toolCallId || !toolName || !approval?.id) return;

			const token = signApprovalToken({
				toolCallId,
				userId: session.userId,
				conversationId: session.conversationId,
				repoId: session.repoId,
				name: toolName,
				argsHash: hashArgs(input ?? {}),
			});

			return {
				...chunk,
				value: {
					...value,
					approval: {
						...approval,
						id: token,
					},
				},
			} as typeof chunk;
		},
	};
}

/**
 * Execute approved tool-calls that the client approved but the server
 * hasn't executed yet. Mutates the messages array in-place by adding
 * tool-result parts next to each approved tool-call.
 *
 * Each tool-call MUST carry a server-signed token at `approval.id`
 * (issued by createApprovalSignerMiddleware on the previous turn).
 * Tool-calls without a valid signature get an error tool-result and
 * are NOT executed.
 */
async function executeApprovedTools(
	messages: any[],
	tools: any[],
	session: ApprovalSessionContext,
) {
	// Build a name→execute map from the tools array
	const toolMap = new Map<string, (args: any) => Promise<any>>();
	for (const tool of tools) {
		if (tool.name && tool.execute) {
			toolMap.set(tool.name, tool.execute);
		}
	}

	// Scan ALL assistant messages for approved tool-calls without results
	const pendingCalls: Array<{ call: any; message: any }> = [];

	for (const msg of messages) {
		if (msg.role !== "assistant" || !msg.parts) continue;

		const msgResultIds = new Set<string>();
		for (const part of msg.parts) {
			if (part.type === "tool-result") {
				const id = part.toolCallId || part.id;
				if (id) msgResultIds.add(id);
			}
		}

		for (const part of msg.parts) {
			if (part.type !== "tool-call") continue;
			if (part.state !== "approval-responded") continue;
			if (!part.approval?.approved) continue;
			const id = part.toolCallId || part.id;
			if (id && !msgResultIds.has(id)) {
				pendingCalls.push({ call: part, message: msg });
			}
		}
	}

	if (pendingCalls.length === 0) return;

	console.log(`[executeApproved] processing ${pendingCalls.length} approved tools: ${pendingCalls.map((p) => p.call.name).join(", ")}`);

	for (const { call, message } of pendingCalls) {
		const id = call.toolCallId || call.id;
		let args: any = {};
		if (call.arguments) {
			try { args = JSON.parse(call.arguments); } catch {}
		} else if (call.input) {
			args = call.input;
		}

		const token: string | undefined = call.approval?.id;
		if (!token) {
			console.warn(`[executeApproved] rejecting ${call.name} (${id}): missing approval signature`);
			call.state = "input-complete";
			message.parts.push({
				type: "tool-result",
				toolCallId: id,
				content: JSON.stringify({ error: "approval_signature_missing" }),
				state: "error",
			});
			continue;
		}

		const ok = verifyApprovalToken(token, {
			toolCallId: id,
			userId: session.userId,
			conversationId: session.conversationId,
			repoId: session.repoId,
			name: call.name,
			argsHash: hashArgs(args),
		});

		if (!ok) {
			console.warn(`[executeApproved] rejecting ${call.name} (${id}): invalid approval signature`);
			call.state = "input-complete";
			message.parts.push({
				type: "tool-result",
				toolCallId: id,
				content: JSON.stringify({ error: "approval_signature_invalid" }),
				state: "error",
			});
			continue;
		}

		const execute = toolMap.get(call.name);
		if (!execute) continue;

		try {
			const output = await execute(args);
			call.state = "input-complete";
			message.parts.push({
				type: "tool-result",
				toolCallId: id,
				content: typeof output === "string" ? output : JSON.stringify(output),
				state: "complete",
			});
		} catch (err: any) {
			call.state = "input-complete";
			message.parts.push({
				type: "tool-result",
				toolCallId: id,
				content: JSON.stringify({ error: err?.message ?? "Tool execution failed" }),
				state: "error",
			});
		}
	}
}

/**
 * Clean up corrupted TanStack AI messages before sending to the model.
 *
 * OpenAI requires every role:"tool" message to follow an assistant message
 * containing the matching tool_calls entry. TanStack AI's approval flow
 * can produce orphaned tool-results. We aggressively strip them.
 */
function sanitizeMessages(rawMessages: any[]): any[] {
	// Pass 1: Merge split assistant messages. TanStack AI can put a tool-call
	// and its tool-result in separate assistant messages. OpenAI requires them
	// together, so merge tool-result-only assistant messages into the preceding
	// assistant message that contains the matching tool-call.
	const merged: any[] = [];
	for (const msg of rawMessages) {
		merged.push(msg);
	}
	for (let i = merged.length - 1; i >= 0; i--) {
		const msg = merged[i];
		if (msg.role !== "assistant" || !msg.parts) continue;

		const hasOnlyResults = msg.parts.length > 0 && msg.parts.every(
			(p: any) => p.type === "tool-result",
		);
		if (!hasOnlyResults) continue;

		for (let j = i - 1; j >= 0; j--) {
			if (merged[j].role !== "assistant" || !merged[j].parts) continue;
			const hasMatchingCall = merged[j].parts.some(
				(p: any) =>
					p.type === "tool-call" &&
					msg.parts.some(
						(r: any) => (r.toolCallId || r.id) === (p.toolCallId || p.id),
					),
			);
			if (hasMatchingCall) {
				merged[j] = {
					...merged[j],
					parts: [...merged[j].parts, ...msg.parts],
				};
				merged.splice(i, 1);
				break;
			}
		}
	}

	// Pass 2: Build set of completed tool-call IDs by checking each message
	// for calls that have a matching result IN THE SAME message. This prevents
	// a new tool-call from passing because an older call with the same ID had
	// a result in a different message. Approved tool-calls already have results
	// injected by executeApprovedTools() before sanitization runs.
	const completedCallIds = new Set<string>();

	for (const msg of merged) {
		if (!msg.parts) continue;

		const msgResultIds = new Set<string>();
		for (const part of msg.parts) {
			if (part.type === "tool-result") {
				const id = part.toolCallId || part.id;
				if (id) msgResultIds.add(id);
			}
		}

		for (const part of msg.parts) {
			if (part.type === "tool-call" && part.name) {
				const id = part.toolCallId || part.id;
				if (id && msgResultIds.has(id)) {
					completedCallIds.add(id);
				}
			}
		}
	}

	// Pass 3: Strip anything that isn't a completed call/result pair.
	// This removes: pending approvals, orphaned results, nameless calls,
	// and tool-calls whose results are from a different (older) turn.
	const result = merged
		.map((msg: any) => {
			if (msg.role === "tool") {
				if (!msg.tool_call_id || !completedCallIds.has(msg.tool_call_id)) return null;
				return msg;
			}

			if (!msg.parts) return msg;

			const cleanParts = msg.parts
				.filter((part: any) => {
					if (part.type === "tool-call") {
						if (!part.name) return false;
						const id = part.toolCallId || part.id;
						return id && completedCallIds.has(id);
					}
					if (part.type === "tool-result") {
						const id = part.toolCallId || part.id;
						return id && completedCallIds.has(id);
					}
					return true;
				})
				.map((part: any) => {
					const id = part.toolCallId || part.id;
					if (part.type === "tool-call" && completedCallIds.has(id)) {
						if (part.state !== "input-complete" && part.state !== "approval-responded") {
							return { ...part, state: "input-complete" };
						}
					}
					if (part.type === "tool-result" && completedCallIds.has(id)) {
						if (part.state !== "complete" && part.state !== "error") {
							return { ...part, state: "complete" };
						}
					}
					return part;
				});

			return { ...msg, parts: cleanParts };
		})
		.filter((msg: any) => {
			if (msg === null) return false;
			if (msg.parts && msg.parts.length === 0) return false;
			return true;
		});

	// Pass 4: Safety net — strip tool-calls from ALL assistant messages
	// that don't have matching tool-results in the same message.
	// Approved calls already have results from executeApprovedTools().
	for (const msg of result) {
		if (msg.role !== "assistant" || !msg.parts) continue;

		const resultIds = new Set<string>();
		for (const part of msg.parts) {
			if (part.type === "tool-result") {
				const id = part.toolCallId || part.id;
				if (id) resultIds.add(id);
			}
		}

		msg.parts = msg.parts.filter((part: any) => {
			if (part.type !== "tool-call") return true;
			const id = part.toolCallId || part.id;
			return id && resultIds.has(id);
		});
	}

	return result.filter((msg: any) => {
		if (msg.parts && msg.parts.length === 0) return false;
		return true;
	});
}
