import { z } from "zod";
import { and, eq, or, sql } from "drizzle-orm";
import { authedProcedure } from "../init";
import { assertRepoOwner } from "@tripwire/core";
import { db } from "@tripwire/db/client";
import {
	ruleConfigs,
	whitelistEntries,
	blacklistEntries,
	organizations,
	repositories,
	DEFAULT_RULE_CONFIG,
	type RuleConfig,
} from "@tripwire/db";
import { logEvent } from '@tripwire/core';
import { describeRuleConfigChanges, normalizeRuleConfig } from '@tripwire/core';
import { ruleConfigSchema } from '@tripwire/core';
import { getInstallationToken, getUser, isGitHubUsername, putRepoFile } from '@tripwire/github';
import {
	generateHoneypotPhrase,
	generateAgentsMd,
	generatePrTemplate,
	generateRulesMd,
	pickHoneypotPhrase,
} from '@tripwire/github';

import type { TRPCRouterRecord } from "@trpc/server";

type RepoRow = typeof repositories.$inferSelect;
type OrgRow = typeof organizations.$inferSelect;
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockListMembership(tx: DbTx, repoId: string, username: string) {
	await tx.execute(sql`
		select pg_advisory_xact_lock(hashtext(${repoId}), hashtext(${username.toLowerCase()}))
	`);
}

async function lockRuleConfig(tx: DbTx, repoId: string) {
	await tx.execute(sql`
		select pg_advisory_xact_lock(hashtext(${repoId}))
	`);
}

function uniqueUsernames(usernames: string[] | undefined): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const raw of usernames ?? []) {
		const username = raw.trim();
		const key = username.toLowerCase();
		if (!username || seen.has(key)) continue;
		seen.add(key);
		unique.push(username);
	}
	return unique;
}

function mergeRuleConfigChanges(
	baseConfig: RuleConfig,
	targetConfig: RuleConfig,
	currentConfig: RuleConfig,
): RuleConfig {
	return normalizeRuleConfig(
		mergeChangedFields(baseConfig, targetConfig, currentConfig) as RuleConfig,
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeChangedFields(baseValue: unknown, targetValue: unknown, currentValue: unknown): unknown {
	if (JSON.stringify(baseValue) === JSON.stringify(targetValue)) {
		return currentValue;
	}

	if (isRecord(baseValue) && isRecord(targetValue) && isRecord(currentValue)) {
		const keys = new Set([
			...Object.keys(baseValue),
			...Object.keys(targetValue),
			...Object.keys(currentValue),
		]);
		const merged: Record<string, unknown> = {};
		for (const key of keys) {
			merged[key] = mergeChangedFields(baseValue[key], targetValue[key], currentValue[key]);
		}
		return merged;
	}

	return targetValue;
}

async function resolveListUsers(
	token: string,
	usernames: string[],
): Promise<Array<{ login: string; id: number; avatarUrl: string | null }>> {
	const users = [];
	for (const username of usernames) {
		if (!isGitHubUsername(username)) continue;
		const ghUser = await getUser(token, username) as {
			login: string;
			id: number;
			avatar_url?: string | null;
		};
		users.push({
			login: ghUser.login,
			id: ghUser.id,
			avatarUrl: ghUser.avatar_url ?? null,
		});
	}
	return users;
}

export const rulesRouter = {
	/** Get rule config for a repo */
	getConfig: authedProcedure
		.input(z.object({ repoId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const [config] = await db
				.select()
				.from(ruleConfigs)
				.where(eq(ruleConfigs.repoId, input.repoId));
			return config?.config ?? DEFAULT_RULE_CONFIG;
		}),

	/** Update rule config for a repo (upsert) */
	updateConfig: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				config: ruleConfigSchema,
				baseConfig: ruleConfigSchema.optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { repo, org } = await assertRepoOwner(ctx.user.id, input.repoId);

			const { previousConfig, nextConfig } = await db.transaction(async (tx) => {
				await lockRuleConfig(tx, input.repoId);

				const [existing] = await tx
					.select()
					.from(ruleConfigs)
					.where(eq(ruleConfigs.repoId, input.repoId));

				const previousConfig = normalizeRuleConfig(existing?.config ?? DEFAULT_RULE_CONFIG);
				let nextConfig = input.baseConfig
					? mergeRuleConfigChanges(
							normalizeRuleConfig(input.baseConfig),
							normalizeRuleConfig(input.config),
							previousConfig,
						)
					: normalizeRuleConfig(input.config);

				// If a honeypot file was just enabled and no phrases exist yet, mint one.
				if (
					nextConfig.repoFiles.prTemplate.honeypotEnabled &&
					nextConfig.repoFiles.prTemplate.honeypotPhrases.length === 0
				) {
					nextConfig = {
						...nextConfig,
						repoFiles: {
							...nextConfig.repoFiles,
							prTemplate: {
								...nextConfig.repoFiles.prTemplate,
								honeypotPhrases: [generateHoneypotPhrase()],
							},
						},
					};
				}

				if (
					nextConfig.repoFiles.agentsMd.honeypotEnabled &&
					nextConfig.repoFiles.agentsMd.honeypotPhrases.length === 0
				) {
					nextConfig = {
						...nextConfig,
						repoFiles: {
							...nextConfig.repoFiles,
							agentsMd: {
								...nextConfig.repoFiles.agentsMd,
								honeypotPhrases: [generateHoneypotPhrase()],
							},
						},
					};
				}

				await tx
					.insert(ruleConfigs)
					.values({
						repoId: input.repoId,
						config: nextConfig,
					})
					.onConflictDoUpdate({
						target: ruleConfigs.repoId,
						set: { config: nextConfig, updatedAt: new Date() },
					});

				return { previousConfig, nextConfig };
			});

			const changes = describeRuleConfigChanges(previousConfig, nextConfig);

			await logEvent({
				repoId: input.repoId,
				action: "rule_config_updated",
				severity: "info",
				description: changes.length > 0
					? `Rules updated: ${changes.join(", ")}`
					: "Rule configuration updated",
				metadata: {
					updatedBy: ctx.user?.name ?? ctx.user?.id,
					changes,
					newConfig: nextConfig,
				},
			});

			// Auto-sync repo files when their toggles are on. Errors are
			// logged but don't fail the save — these are best-effort writes.
			if (nextConfig.repoFiles.rulesMd.autoSync) {
				void syncRepoFileSafe(repo, org, "rules-md", nextConfig);
			}
			if (nextConfig.repoFiles.prTemplate.autoSync) {
				void syncRepoFileSafe(repo, org, "pr-template", nextConfig);
			}
			if (nextConfig.repoFiles.agentsMd.autoSync) {
				void syncRepoFileSafe(repo, org, "agents-md", nextConfig);
			}

			return nextConfig;
		}),

	/** Persist a user-edited override for RULES.md, PR template, or AGENTS.md content. */
	updateRepoFileContent: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				kind: z.enum(["rules-md", "pr-template", "agents-md"]),
				content: z.string().max(50_000),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			await db.transaction(async (tx) => {
				await lockRuleConfig(tx, input.repoId);
				const [existing] = await tx
					.select()
					.from(ruleConfigs)
					.where(eq(ruleConfigs.repoId, input.repoId));
				const current = normalizeRuleConfig(existing?.config ?? DEFAULT_RULE_CONFIG);
				let next: RuleConfig;
				if (input.kind === "rules-md") {
					next = {
						...current,
						repoFiles: {
							...current.repoFiles,
							rulesMd: { ...current.repoFiles.rulesMd, customContent: input.content },
						},
					};
				} else if (input.kind === "agents-md") {
					next = {
						...current,
						repoFiles: {
							...current.repoFiles,
							agentsMd: { ...current.repoFiles.agentsMd, customContent: input.content },
						},
					};
				} else {
					next = {
						...current,
						repoFiles: {
							...current.repoFiles,
							prTemplate: { ...current.repoFiles.prTemplate, customContent: input.content },
						},
					};
				}
				await tx
					.insert(ruleConfigs)
					.values({ repoId: input.repoId, config: next })
					.onConflictDoUpdate({
						target: ruleConfigs.repoId,
						set: { config: next, updatedAt: new Date() },
					});
			});
			return { ok: true as const };
		}),

	/** Manually push the generated RULES.md or PR template to the repo. */
	syncRepoFile: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				kind: z.enum(["rules-md", "pr-template", "agents-md"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { repo, org } = await assertRepoOwner(ctx.user.id, input.repoId);
			const [configRow] = await db
				.select()
				.from(ruleConfigs)
				.where(eq(ruleConfigs.repoId, input.repoId));
			const config = normalizeRuleConfig(configRow?.config ?? DEFAULT_RULE_CONFIG);
			const result = await syncRepoFile(repo, org, input.kind, config);
			return result;
		}),

	/** Count enabled rules for a repo */
	countEnabled: authedProcedure
		.input(z.object({ repoId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const [configRow] = await db
				.select()
				.from(ruleConfigs)
				.where(eq(ruleConfigs.repoId, input.repoId));

			const config = configRow?.config ?? DEFAULT_RULE_CONFIG;
			let enabledCount = 0;

			for (const value of Object.values(config)) {
				if (typeof value === "object" && value !== null && "enabled" in value) {
					if ((value as { enabled: boolean }).enabled) {
						enabledCount++;
					}
				}
			}

			return { enabled: enabledCount, total: Object.keys(config).length };
		}),

	/** Export config as JSON (for copy-to-another-repo) */
	exportConfig: authedProcedure
		.input(z.object({ repoId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			const [config] = await db
				.select()
				.from(ruleConfigs)
				.where(eq(ruleConfigs.repoId, input.repoId));

			const whitelist = await db
				.select()
				.from(whitelistEntries)
				.where(eq(whitelistEntries.repoId, input.repoId));

			const blacklist = await db
				.select()
				.from(blacklistEntries)
				.where(eq(blacklistEntries.repoId, input.repoId));

			return {
				rules: config?.config ?? DEFAULT_RULE_CONFIG,
				whitelist: whitelist.map((w) => w.githubUsername),
				blacklist: blacklist.map((b) => b.githubUsername),
			};
		}),

	/** Import config from JSON */
	importConfig: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				config: ruleConfigSchema,
				whitelist: z.array(z.string()).optional(),
				blacklist: z.array(z.string()).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { org } = await assertRepoOwner(ctx.user.id, input.repoId);
			const token = await getInstallationToken(org.githubInstallationId);
			const importedWhitelistUsers = await resolveListUsers(token, uniqueUsernames(input.whitelist));
			const importedBlacklistUsers = await resolveListUsers(token, uniqueUsernames(input.blacklist));

			// Persist rule config + whitelist + blacklist atomically. If the lists
			// fail to insert we don't want the rule config drifting from them.
			//
			// Blacklist wins on import, matching the manual list mutation paths.
			// A username present in both imported lists, or already blacklisted in
			// this repo, must not remain whitelisted.
			await db.transaction(async (tx) => {
				await lockRuleConfig(tx, input.repoId);

				const nextConfig = normalizeRuleConfig(input.config);
				await tx
					.insert(ruleConfigs)
					.values({
						repoId: input.repoId,
						config: nextConfig,
					})
					.onConflictDoUpdate({
						target: ruleConfigs.repoId,
						set: { config: nextConfig, updatedAt: new Date() },
					});

				const affectedUsernames = new Set([
					...importedWhitelistUsers.map((user) => user.login.toLowerCase()),
					...importedBlacklistUsers.map((user) => user.login.toLowerCase()),
				]);
				for (const githubUsername of affectedUsernames) {
					await lockListMembership(tx, input.repoId, githubUsername);
				}

				const importedBlacklistKeys = new Set(
					importedBlacklistUsers.map((user) => user.login.toLowerCase()),
				);
				const importedBlacklistIds = new Set(
					importedBlacklistUsers.map((user) => user.id),
				);
				const existingBlacklist =
					importedWhitelistUsers.length > 0
						? await tx
								.select({
									githubUsername: blacklistEntries.githubUsername,
									githubUserId: blacklistEntries.githubUserId,
								})
								.from(blacklistEntries)
								.where(eq(blacklistEntries.repoId, input.repoId))
						: [];
				const importedWhitelistKeys = new Set(
					importedWhitelistUsers.map((user) => user.login.toLowerCase()),
				);
				const importedWhitelistIds = new Set(
					importedWhitelistUsers.map((user) => user.id),
				);
				const blockedUsernames = new Set([
					...importedBlacklistKeys,
					...existingBlacklist.map((entry) =>
						entry.githubUsername.toLowerCase(),
					).filter((githubUsername) => importedWhitelistKeys.has(githubUsername)),
				]);
				const blockedUserIds = new Set([
					...importedBlacklistIds,
					...existingBlacklist.map((entry) => entry.githubUserId)
						.filter((githubUserId): githubUserId is number =>
							githubUserId != null && importedWhitelistIds.has(githubUserId)
						),
				]);
				const whitelist = importedWhitelistUsers.filter(
					(user) =>
						!blockedUsernames.has(user.login.toLowerCase()) &&
						!blockedUserIds.has(user.id),
				);

				for (const githubUsername of blockedUsernames) {
					await tx
						.delete(whitelistEntries)
						.where(
							and(
								eq(whitelistEntries.repoId, input.repoId),
								sql`lower(${whitelistEntries.githubUsername}) = ${githubUsername}`,
							),
						);
				}
				for (const githubUserId of blockedUserIds) {
					await tx
						.delete(whitelistEntries)
						.where(
							and(
								eq(whitelistEntries.repoId, input.repoId),
								eq(whitelistEntries.githubUserId, githubUserId),
							),
						);
				}

				if (whitelist.length > 0) {
					await tx
						.insert(whitelistEntries)
						.values(
							whitelist.map((user) => ({
								repoId: input.repoId,
								githubUsername: user.login,
								githubUserId: user.id,
								avatarUrl: user.avatarUrl,
								addedById: ctx.user.id,
							})),
						)
						.onConflictDoNothing();
				}

				if (importedBlacklistUsers.length > 0) {
					for (const user of importedBlacklistUsers) {
						await tx
							.delete(whitelistEntries)
							.where(
								and(
									eq(whitelistEntries.repoId, input.repoId),
									or(
										eq(whitelistEntries.githubUserId, user.id),
										sql`lower(${whitelistEntries.githubUsername}) = ${user.login.toLowerCase()}`,
									),
								),
							);
					}

					await tx
						.insert(blacklistEntries)
						.values(
							importedBlacklistUsers.map((user) => ({
								repoId: input.repoId,
								githubUsername: user.login,
								githubUserId: user.id,
								avatarUrl: user.avatarUrl,
								addedById: ctx.user.id,
							})),
						)
						.onConflictDoNothing();
				}
			});

			return { success: true };
		}),
} satisfies TRPCRouterRecord;


type RepoFileKind = "rules-md" | "pr-template" | "agents-md";

async function syncRepoFile(
	repo: RepoRow,
	org: OrgRow,
	kind: RepoFileKind,
	config: RuleConfig,
): Promise<{ kind: RepoFileKind; path: string }> {
	const token = await getInstallationToken(org.githubInstallationId);
	const [owner, repoName] = repo.fullName.split("/");

	if (kind === "rules-md") {
		const custom = config.repoFiles.rulesMd.customContent;
		const content = custom.trim().length > 0 ? custom : generateRulesMd(config, repo.fullName);
		await putRepoFile(token, owner, repoName, "RULES.md", content, "chore: sync Tripwire RULES.md");
		return { kind, path: "RULES.md" };
	}

	if (kind === "agents-md") {
		const phrase = config.repoFiles.agentsMd.honeypotEnabled
			? pickHoneypotPhrase(config.repoFiles.agentsMd.honeypotPhrases)
			: undefined;
		const custom = config.repoFiles.agentsMd.customContent;
		const content =
			custom.trim().length > 0 ? custom : generateAgentsMd(config, repo.fullName, phrase);
		const path = ".github/AGENTS.md";
		await putRepoFile(token, owner, repoName, path, content, "chore: sync Tripwire AGENTS.md");
		return { kind, path };
	}

	const phrase = config.repoFiles.prTemplate.honeypotEnabled
		? pickHoneypotPhrase(config.repoFiles.prTemplate.honeypotPhrases)
		: undefined;
	const customPr = config.repoFiles.prTemplate.customContent;
	const content =
		customPr.trim().length > 0 ? customPr : generatePrTemplate(config, phrase);
	const path = ".github/PULL_REQUEST_TEMPLATE.md";
	await putRepoFile(token, owner, repoName, path, content, "chore: sync Tripwire PR template");
	return { kind, path };
}

async function syncRepoFileSafe(
	repo: RepoRow,
	org: OrgRow,
	kind: RepoFileKind,
	config: RuleConfig,
): Promise<void> {
	try {
		await syncRepoFile(repo, org, kind, config);
	} catch (err) {
		console.error(`[repo-files] auto-sync ${kind} failed for ${repo.id}:`, err);
	}
}
