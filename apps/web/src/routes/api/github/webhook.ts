import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature } from "@tripwire/github";
import {
	handlePullRequest,
	handleIssue,
	handleComment,
	checkFakeBountyReference,
	handleFakeBountyCatch,
} from "@tripwire/core";
import { db } from "@tripwire/db/client";
import { events, organizations, repositories } from "@tripwire/db";
import { and, eq } from "drizzle-orm";
import {
	handleInstallation,
	handleInstallationRepositories,
} from "#/lib/github-webhook";

const WEBHOOK_BODY_LIMIT_BYTES = 5 * 1024 * 1024;

async function handler({ request }: { request: Request }) {
	const secret = process.env.GITHUB_WEBHOOK_SECRET;
	if (!secret) {
		console.error("[Webhook] GITHUB_WEBHOOK_SECRET is not configured");
		return new Response("Server misconfigured", { status: 500 });
	}

	const signature = request.headers.get("x-hub-signature-256");
	if (!signature) {
		return new Response("Invalid signature", { status: 401 });
	}

	let body: string;
	try {
		body = await readLimitedBody(request);
	} catch {
		return new Response("Payload too large", { status: 413 });
	}

	const valid = await verifyWebhookSignature(body, signature, secret);
	if (!valid) {
		return new Response("Invalid signature", { status: 401 });
	}

	const event = request.headers.get("x-github-event");
	let payload: any;
	try {
		payload = JSON.parse(body);
	} catch {
		return new Response("Invalid JSON", { status: 400 });
	}
	console.log("[Webhook] Event:", event, "| Action:", payload.action);

	const installationId = payload.installation?.id;
	if (!Number.isSafeInteger(installationId) || installationId <= 0) {
		return new Response("No installation", { status: 200 });
	}

	if (event === "installation") {
		try {
			await handleInstallation(payload);
		} catch (err) {
			console.error("[Webhook] installation handler error:", err);
		}
		return new Response("OK", { status: 200 });
	}

	if (event === "installation_repositories") {
		try {
			await handleInstallationRepositories(payload);
		} catch (err) {
			console.error("[Webhook] installation_repositories handler error:", err);
		}
		return new Response("OK", { status: 200 });
	}

	const repo = payload.repository;
	if (!repo) return new Response("OK", { status: 200 });

	const ctx = {
		installationId,
		repoFullName: repo.full_name,
		githubRepoId: repo.id,
		senderLogin: payload.sender?.login ?? "",
		senderId: payload.sender?.id ?? 0,
	};

	try {
		switch (event) {
			case "pull_request": {
				if (payload.action === "opened" || payload.action === "reopened") {
					const prContent = `${payload.pull_request.title ?? ""}\n${payload.pull_request.body ?? ""}`;
					const [repoRow] = await db
						.select({ id: repositories.id })
						.from(repositories)
						.innerJoin(organizations, eq(repositories.orgId, organizations.id))
						.where(
							and(
								eq(repositories.githubRepoId, repo.id),
								eq(organizations.githubInstallationId, installationId),
							),
						);

					if (repoRow) {
						const bountyHit = await checkFakeBountyReference(repoRow.id, prContent);
						if (bountyHit) {
							await handleFakeBountyCatch({
								repoId: repoRow.id,
								bountyId: bountyHit.bountyId,
								githubUsername: ctx.senderLogin,
								githubUserId: ctx.senderId,
								githubRef: `#${payload.pull_request.number}`,
								refType: "pr",
								prNumber: payload.pull_request.number,
								installationId: ctx.installationId,
								repoFullName: ctx.repoFullName,
							});
							break;
						}
					}

					await handlePullRequest(
						ctx,
						payload.pull_request.number,
						payload.pull_request.title,
						payload.pull_request.body ?? undefined,
					);
				}
				break;
			}

			case "issues": {
				if (payload.action === "opened" || payload.action === "reopened") {
					await handleIssue(
						ctx,
						payload.issue.number,
						payload.issue.title,
						payload.issue.body ?? undefined,
					);
				}
				break;
			}

			case "issue_comment": {
				if (payload.sender?.type === "Bot") break;
				if (payload.action === "created") {
					const commentId = payload.comment?.id;
					const issueNumber = payload.issue?.number;
					if (!Number.isSafeInteger(commentId) || !Number.isSafeInteger(issueNumber)) {
						break;
					}

					const repoId = await findRepoIdForInstallation(repo.id, installationId);
					if (repoId && await hasProcessedIssueComment(repoId, issueNumber, commentId)) {
						console.log("[Webhook] Duplicate issue_comment delivery skipped:", {
							repoId,
							commentId,
							issueNumber,
						});
						break;
					}

					await handleComment(
						ctx,
						commentId,
						issueNumber,
						payload.comment.body ?? undefined,
					);
				}
				break;
			}
		}
	} catch (err) {
		console.error("Webhook handler error:", err);
	}

	return new Response("OK", { status: 200 });
}

async function readLimitedBody(request: Request): Promise<string> {
	const contentLength = request.headers.get("content-length");
	if (contentLength) {
		const parsedLength = Number(contentLength);
		if (!Number.isFinite(parsedLength) || parsedLength > WEBHOOK_BODY_LIMIT_BYTES) {
			throw new Error("Webhook payload too large");
		}
	}

	if (!request.body) return "";

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		total += value.byteLength;
		if (total > WEBHOOK_BODY_LIMIT_BYTES) {
			throw new Error("Webhook payload too large");
		}
		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder().decode(body);
}

async function findRepoIdForInstallation(githubRepoId: number, installationId: number) {
	const [row] = await db
		.select({ id: repositories.id })
		.from(repositories)
		.innerJoin(organizations, eq(repositories.orgId, organizations.id))
		.where(
			and(
				eq(repositories.githubRepoId, githubRepoId),
				eq(organizations.githubInstallationId, installationId),
			),
		)
		.limit(1);

	return row?.id;
}

async function hasProcessedIssueComment(
	repoId: string,
	issueNumber: number,
	commentId: number,
): Promise<boolean> {
	const [existing] = await db
		.select({ id: events.id })
		.from(events)
		.where(
			and(
				eq(events.repoId, repoId),
				eq(events.contentType, "comment"),
				eq(events.githubRef, `#${issueNumber}/comment/${commentId}`),
			),
		)
		.limit(1);

	return Boolean(existing);
}

export const Route = createFileRoute("/api/github/webhook")({
	server: {
		handlers: { POST: handler },
	},
});
