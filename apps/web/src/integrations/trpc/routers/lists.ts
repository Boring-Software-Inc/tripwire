import { z } from "zod";
import { eq, and, or, sql } from "drizzle-orm";
import { authedProcedure } from "../init";
import { assertRepoOwner } from "@tripwire/core";
import { trpcError } from "../error";
import { db } from "@tripwire/db/client";
import { whitelistEntries, blacklistEntries } from "@tripwire/db";
import { logEvent } from '@tripwire/core';
import { encodeGitHubUsername, getInstallationToken, getRepoContributors, isGitHubUsername } from '@tripwire/github';

import type { TRPCRouterRecord } from "@trpc/server";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockListMembership(tx: DbTx, repoId: string, username: string) {
	await tx.execute(sql`
		select pg_advisory_xact_lock(hashtext(${repoId}), hashtext(${username.toLowerCase()}))
	`);
}

// Validate GitHub user exists and get their info
async function validateGitHubUser(username: string): Promise<{
	id: number;
	login: string;
	avatar_url: string;
}> {
	const res = await fetch(`https://api.github.com/users/${encodeGitHubUsername(username)}`, {
		headers: {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "Tripwire",
		},
	});

	if (res.status === 404) {
		throw trpcError({
			code: "github.user_not_found",
			status: 404,
			message: `GitHub user "${username}" not found`,
			fix: "Double-check the username spelling and try again.",
			internal: { username },
		});
	}

	if (!res.ok) {
		throw trpcError({
			code: "github.user_lookup_failed",
			status: 500,
			message: "Failed to validate GitHub user",
			why: `GitHub responded with HTTP ${res.status}.`,
			internal: { username, githubStatus: res.status },
		});
	}

	return res.json();
}

export const whitelistRouter = {
	list: authedProcedure
		.input(z.object({ repoId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			return db
				.select()
				.from(whitelistEntries)
				.where(eq(whitelistEntries.repoId, input.repoId));
		}),

	add: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				githubUsername: z.string().min(1).refine(isGitHubUsername, "Invalid GitHub username"),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const ghUser = await validateGitHubUser(input.githubUsername);

			// Atomically check blacklist + insert into whitelist. The unique index
			// `whitelist_repo_username_uniq` on (repoId, lower(githubUsername))
			// guarantees the insert is race-safe; ON CONFLICT DO NOTHING turns a
			// concurrent duplicate into a clean "already whitelisted" 409.
			const entry = await db.transaction(async (tx) => {
				await lockListMembership(tx, input.repoId, ghUser.login);

				const [blacklisted] = await tx
					.select()
					.from(blacklistEntries)
					.where(
						and(
							eq(blacklistEntries.repoId, input.repoId),
							or(
								eq(blacklistEntries.githubUserId, ghUser.id),
								sql`lower(${blacklistEntries.githubUsername}) = lower(${ghUser.login})`,
							),
						),
					)
					.limit(1);

				if (blacklisted) {
					throw trpcError({
						code: "lists.blacklisted",
						status: 409,
						message: "User is blacklisted — remove from blacklist first",
						fix: "Open the People tab, remove the user from the blacklist, then re-try adding to the whitelist.",
					});
				}

				const [inserted] = await tx
					.insert(whitelistEntries)
					.values({
						repoId: input.repoId,
						githubUsername: ghUser.login,
						githubUserId: ghUser.id,
						avatarUrl: ghUser.avatar_url,
						addedById: ctx.user?.id,
					})
					.onConflictDoNothing()
					.returning();

				if (!inserted) {
					throw trpcError({
						code: "lists.already_whitelisted",
						status: 409,
						message: "User is already on the whitelist",
					});
				}

				return inserted;
			});

			// logEvent uses the global db connection (not tx-safe) and swallows
			// its own errors — fire it after the transaction commits so we never
			// leak a half-committed list state.
			await logEvent({
				repoId: input.repoId,
				action: "whitelist_added",
				severity: "info",
				description: `@${ghUser.login} was added to the whitelist`,
				targetGithubUsername: ghUser.login,
				targetGithubUserId: ghUser.id,
				metadata: { addedBy: ctx.user?.name ?? ctx.user?.id },
			});

			return entry;
		}),

	remove: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				githubUsername: z.string().min(1).refine(isGitHubUsername, "Invalid GitHub username"),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const [deleted] = await db.transaction(async (tx) => {
				await lockListMembership(tx, input.repoId, input.githubUsername);
				return tx
					.delete(whitelistEntries)
					.where(
						and(
							eq(whitelistEntries.repoId, input.repoId),
							sql`lower(${whitelistEntries.githubUsername}) = ${input.githubUsername.toLowerCase()}`,
						),
					)
					.returning({
						githubUsername: whitelistEntries.githubUsername,
						githubUserId: whitelistEntries.githubUserId,
					});
			});

			if (!deleted) {
				throw trpcError({
					code: "lists.not_whitelisted",
					status: 404,
					message: "User is not on the whitelist",
				});
			}

			await logEvent({
				repoId: input.repoId,
				action: "whitelist_removed",
				severity: "info",
				description: `@${deleted.githubUsername} was removed from the whitelist`,
				targetGithubUsername: deleted.githubUsername,
				targetGithubUserId: deleted.githubUserId ?? undefined,
				metadata: { removedBy: ctx.user?.name ?? ctx.user?.id },
			});

			return { success: true };
		}),

	suggestedContributors: authedProcedure
		.input(z.object({ repoId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			const { repo, org } = await assertRepoOwner(ctx.user.id, input.repoId);

			let token: string;
			try {
				token = await getInstallationToken(org.githubInstallationId);
			} catch {
				return [];
			}

			const contributors = await getRepoContributors(token, repo.fullName);
			if (contributors.length === 0) return [];

			const existing = await db.select({ username: whitelistEntries.githubUsername }).from(whitelistEntries).where(eq(whitelistEntries.repoId, input.repoId));
			const whitelisted = new Set(existing.map((e) => e.username.toLowerCase()));

			return contributors
				.filter((c) => !whitelisted.has(c.login.toLowerCase()))
				.map((c) => ({ username: c.login, avatarUrl: c.avatarUrl, contributions: c.contributions }));
		}),
} satisfies TRPCRouterRecord;

export const blacklistRouter = {
	list: authedProcedure
		.input(z.object({ repoId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			return db
				.select()
				.from(blacklistEntries)
				.where(eq(blacklistEntries.repoId, input.repoId));
		}),

	add: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				githubUsername: z.string().min(1).refine(isGitHubUsername, "Invalid GitHub username"),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const ghUser = await validateGitHubUser(input.githubUsername);

			// Atomically remove any existing whitelist entry and insert the
			// blacklist row. Blacklist must always win — running both in one tx
			// closes the race where a user could remain whitelisted after being
			// added to the blacklist. The unique index
			// `blacklist_repo_username_uniq` on (repoId, lower(githubUsername))
			// makes ON CONFLICT DO NOTHING the race-safe "already blacklisted"
			// path.
			const entry = await db.transaction(async (tx) => {
				await lockListMembership(tx, input.repoId, ghUser.login);

				await tx
					.delete(whitelistEntries)
					.where(
						and(
							eq(whitelistEntries.repoId, input.repoId),
							or(
								eq(whitelistEntries.githubUserId, ghUser.id),
								sql`lower(${whitelistEntries.githubUsername}) = lower(${ghUser.login})`,
							),
						),
					);

				const [inserted] = await tx
					.insert(blacklistEntries)
					.values({
						repoId: input.repoId,
						githubUsername: ghUser.login,
						githubUserId: ghUser.id,
						avatarUrl: ghUser.avatar_url,
						addedById: ctx.user?.id,
					})
					.onConflictDoNothing()
					.returning();

				if (!inserted) {
					throw trpcError({
						code: "lists.already_blacklisted",
						status: 409,
						message: "User is already on the blacklist",
					});
				}

				return inserted;
			});

			// logEvent uses the global db connection (not tx-safe) and swallows
			// its own errors — fire it after the transaction commits.
			await logEvent({
				repoId: input.repoId,
				action: "blacklist_added",
				severity: "warning",
				description: `@${ghUser.login} was added to the blacklist`,
				targetGithubUsername: ghUser.login,
				targetGithubUserId: ghUser.id,
				metadata: { addedBy: ctx.user?.name ?? ctx.user?.id },
			});

			return entry;
		}),

	remove: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				githubUsername: z.string().min(1).refine(isGitHubUsername, "Invalid GitHub username"),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const [deleted] = await db.transaction(async (tx) => {
				await lockListMembership(tx, input.repoId, input.githubUsername);
				return tx
					.delete(blacklistEntries)
					.where(
						and(
							eq(blacklistEntries.repoId, input.repoId),
							sql`lower(${blacklistEntries.githubUsername}) = ${input.githubUsername.toLowerCase()}`,
						),
					)
					.returning({
						githubUsername: blacklistEntries.githubUsername,
						githubUserId: blacklistEntries.githubUserId,
					});
			});

			if (!deleted) {
				throw trpcError({
					code: "lists.not_blacklisted",
					status: 404,
					message: "User is not on the blacklist",
				});
			}

			await logEvent({
				repoId: input.repoId,
				action: "blacklist_removed",
				severity: "info",
				description: `@${deleted.githubUsername} was removed from the blacklist`,
				targetGithubUsername: deleted.githubUsername,
				targetGithubUserId: deleted.githubUserId ?? undefined,
				metadata: { removedBy: ctx.user?.name ?? ctx.user?.id },
			});

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
