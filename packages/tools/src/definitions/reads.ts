import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createError } from "evlog";
import { db } from "@tripwire/db/client";
import {
	blacklistEntries,
	events,
	githubReputation,
	organizations,
	repositories,
	whitelistEntries,
	type EventAction,
} from "@tripwire/db";
import {
	assertEventOwner,
	assertRepoOwner,
} from '@tripwire/core';
import {
	fetchUserAchievements,
	fetchUserGraphQL,
	getClosedPrCount,
	getContextRepoPrCount,
	getInstallationToken,
	getMergedPrCount,
	getPublicForkRepoCount,
	getPublicNonForkRepoCount,
	hasProfileReadme,
} from '@tripwire/github';
import {
	type ScoreCategory,
	type ScoreInput,
	computeContributorScore,
} from '@tripwire/core';
import {
	type AnyToolDefinition,
	defineTool,
	makeSpec,
} from "../registry";
import { requireRepoId } from "../helpers";

function usernameEq(column: unknown, username: string) {
	return sql`lower(${column}) = ${username.toLowerCase()}`;
}

async function getTokenForRepo(repoId: string): Promise<string | null> {
	try {
		const [repo] = await db
			.select({ orgId: repositories.orgId })
			.from(repositories)
			.where(eq(repositories.id, repoId))
			.limit(1);
		if (!repo) return null;
		const [org] = await db
			.select({ installationId: organizations.githubInstallationId })
			.from(organizations)
			.where(eq(organizations.id, repo.orgId))
			.limit(1);
		if (!org) return null;
		return await getInstallationToken(org.installationId);
	} catch {
		return null;
	}
}

interface GitHubUser {
	login: string;
	id: number;
	name?: string | null;
	avatar_url?: string | null;
	bio?: string | null;
	company?: string | null;
	location?: string | null;
	blog?: string | null;
	twitter_username?: string | null;
	public_repos?: number;
	public_gists?: number;
	followers?: number;
	following?: number;
	created_at?: string;
	two_factor_authentication?: boolean;
}

async function fetchGitHubUser(username: string, token?: string): Promise<GitHubUser> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "Tripwire",
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`https://api.github.com/users/${username}`, { headers });
	if (!res.ok) {
		throw createError({
			code: "github.user_not_found",
			status: 404,
			message: `GitHub user @${username} not found`,
			internal: { username, githubStatus: res.status },
		});
	}
	return res.json() as Promise<GitHubUser>;
}

const fmtDate = (d: Date) =>
	d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// ─── list_repos (no repo context required) ───────────────────────

const listRepos = defineTool({
	name: "list_repos",
	description:
		"List GitHub repositories the caller has connected to Tripwire. Returns repo id (use this for other tools), full name, privacy, and the owning GitHub org login.",
	needsRepo: false,
	inputSchema: z.object({}),
	handler: async (_args, ctx) =>
		db
			.select({
				id: repositories.id,
				fullName: repositories.fullName,
				name: repositories.name,
				isPrivate: repositories.isPrivate,
				orgId: repositories.orgId,
				orgLogin: organizations.githubAccountLogin,
			})
			.from(repositories)
			.innerJoin(organizations, eq(repositories.orgId, organizations.id))
			.where(eq(organizations.ownerId, ctx.userId)),
});

// ─── list_events ─────────────────────────────────────────────────

const listEvents = defineTool({
	name: "list_events",
	description:
		"List recent moderation events for the current repo (newest first). Filterable by username, action, severity.",
	inputSchema: z.object({
		username: z.string().optional(),
		action: z.string().optional(),
		severity: z.enum(["info", "warning", "error", "success"]).optional(),
		limit: z.number().int().min(1).max(50).optional(),
	}),
	handler: async ({ username, action, severity, limit }, ctx) => {
		const repoId = requireRepoId(ctx);
		await assertRepoOwner(ctx.userId, repoId);

		const conditions = [eq(events.repoId, repoId)];
		if (username) conditions.push(usernameEq(events.targetGithubUsername, username));
		if (action) conditions.push(eq(events.action, action as EventAction));
		if (severity) conditions.push(eq(events.severity, severity));

		return db
			.select()
			.from(events)
			.where(and(...conditions))
			.orderBy(desc(events.createdAt))
			.limit(limit ?? 10);
	},
	chatRender: (rows) =>
		makeSpec("EventsList", {
			title: "Recent Events",
			events: rows.map((e) => ({
				id: e.id,
				action: e.action,
				severity: (e.severity ?? "info") as "info" | "warning" | "error",
				description: e.description ?? "",
				date: fmtDate(e.createdAt),
				username: e.targetGithubUsername,
			})),
		}),
});

// ─── get_event ───────────────────────────────────────────────────

const getEvent = defineTool({
	name: "get_event",
	description: "Fetch a single Tripwire event by id.",
	needsRepo: false,
	lazy: true,
	inputSchema: z.object({ eventId: z.string().uuid() }),
	handler: async ({ eventId }, ctx) => {
		const { event, repo } = await assertEventOwner(ctx.userId, eventId);
		return { event, repo: { id: repo.id, fullName: repo.fullName } };
	},
	chatRender: ({ event }) =>
		makeSpec("EventCard", {
			id: event.id,
			action: event.action,
			severity: (event.severity ?? "info") as "info" | "warning" | "error",
			description: event.description ?? "",
			date: fmtDate(event.createdAt),
			username: event.targetGithubUsername,
		}),
});

// ─── lookup_user ─────────────────────────────────────────────────

// ─── Shared user signal fetch ────────────────────────────────────
// Used by both lookup_user (UserCard) and score_breakdown (ScoreBreakdown).

interface UserSignals {
	ghUser: GitHubUser;
	scoreInput: ScoreInput;
	status: "normal" | "blacklisted" | "whitelisted";
	badges: string[];
}

async function gatherUserSignals(
	username: string,
	userId: string,
	repoId: string,
): Promise<UserSignals> {
	await assertRepoOwner(userId, repoId);
	const token = await getTokenForRepo(repoId);
	const [repoRow] = await db
		.select({ fullName: repositories.fullName })
		.from(repositories)
		.where(eq(repositories.id, repoId))
		.limit(1);
	const contextRepoFullName = repoRow?.fullName ?? "";

	const [
		ghUser,
		whitelist,
		blacklist,
		allEvents,
		reputationRow,
		mergedPrs,
		closedPrs,
		publicNonForkRepos,
		publicForkRepos,
		prsToThisRepo,
		profileReadme,
		graphqlData,
		achievements,
	] = await Promise.all([
		fetchGitHubUser(username, token ?? undefined),
		db
			.select()
			.from(whitelistEntries)
			.where(
				and(
					eq(whitelistEntries.repoId, repoId),
					usernameEq(whitelistEntries.githubUsername, username),
				),
			)
			.limit(1),
		db
			.select()
			.from(blacklistEntries)
			.where(
				and(
					eq(blacklistEntries.repoId, repoId),
					usernameEq(blacklistEntries.githubUsername, username),
				),
			)
			.limit(1),
		db
			.select()
			.from(events)
			.where(
				and(
					eq(events.repoId, repoId),
					usernameEq(events.targetGithubUsername, username),
				),
			),
		db
			.select({ scoreResetAt: githubReputation.scoreResetAt })
			.from(githubReputation)
			.where(
				and(
					eq(githubReputation.repoId, repoId),
					sql`lower(${githubReputation.githubUsername}) = ${username.toLowerCase()}`,
				),
			)
			.limit(1),
		token ? getMergedPrCount(token, username).catch(() => 0) : Promise.resolve(0),
		token ? getClosedPrCount(token, username).catch(() => 0) : Promise.resolve(0),
		token ? getPublicNonForkRepoCount(token, username).catch(() => 0) : Promise.resolve(0),
		token ? getPublicForkRepoCount(token, username).catch(() => 0) : Promise.resolve(0),
		token && contextRepoFullName
			? getContextRepoPrCount(token, username, contextRepoFullName).catch(() => 0)
			: Promise.resolve(0),
		token ? hasProfileReadme(token, username).catch(() => false) : Promise.resolve(false),
		token ? fetchUserGraphQL(token, username).catch(() => null) : Promise.resolve(null),
		fetchUserAchievements(username).catch(() => []),
	]);

	const scoreResetAt = reputationRow[0]?.scoreResetAt ?? null;
	const countsAfterReset = scoreResetAt
		? allEvents.filter((e) => e.createdAt > scoreResetAt)
		: allEvents;

	const closedUnmergedPrs = Math.max(0, closedPrs - mergedPrs);
	const blockedCount = countsAfterReset.filter((e) => e.action === "pipeline_blocked").length;
	const allowedCount = countsAfterReset.filter((e) => e.action === "pipeline_allowed").length;
	const nearMissCount = countsAfterReset.filter((e) => e.action === "rule_near_miss").length;
	const createdAt = ghUser.created_at ? new Date(ghUser.created_at) : new Date();
	const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);

	const badges: string[] = [];
	if (graphqlData?.isGitHubStar) badges.push("GitHub Star");
	if (graphqlData?.isBountyHunter) badges.push("Bug Bounty Hunter");
	if (graphqlData?.isDeveloperProgramMember) badges.push("Dev Program");
	if (graphqlData?.isCampusExpert) badges.push("Campus Expert");
	if (graphqlData?.isSiteAdmin) badges.push("GitHub Staff");

	const status: UserSignals["status"] =
		blacklist.length > 0 ? "blacklisted" : whitelist.length > 0 ? "whitelisted" : "normal";

	return {
		ghUser,
		scoreInput: {
			accountAgeDays,
			followers: ghUser.followers ?? 0,
			following: ghUser.following ?? 0,
			publicRepos: ghUser.public_repos ?? 0,
			publicNonForkRepoCount: publicNonForkRepos,
			publicForkRepoCount: publicForkRepos,
			contextRepoPrCount: prsToThisRepo,
			publicGists: ghUser.public_gists ?? 0,
			bio: ghUser.bio ?? null,
			company: ghUser.company ?? null,
			location: ghUser.location ?? null,
			blog: ghUser.blog ?? null,
			twitterUsername: ghUser.twitter_username ?? null,
			hasTwoFactor: ghUser.two_factor_authentication ?? false,
			hasProfileReadme: profileReadme,
			graphql: graphqlData,
			achievements,
			mergedPrCount: mergedPrs,
			closedPrCount: closedPrs,
			closedUnmergedPrCount: closedUnmergedPrs,
			blockedCount,
			allowedCount,
			nearMissCount,
		},
		status,
		badges,
	};
}

const lookupUser = defineTool({
	name: "lookup_user",
	description:
		"Look up a GitHub user's profile and their Tripwire activity history for the current repo. Pass the username without @.",
	inputSchema: z.object({ username: z.string().min(1) }),
	handler: async ({ username }, ctx) => {
		const repoId = requireRepoId(ctx);
		const signals = await gatherUserSignals(username, ctx.userId, repoId);
		const score = computeContributorScore(signals.scoreInput);
		return {
			ghUser: signals.ghUser,
			score,
			badges: signals.badges,
			status: signals.status,
			counts: {
				blockedCount: signals.scoreInput.blockedCount,
				allowedCount: signals.scoreInput.allowedCount,
				nearMissCount: signals.scoreInput.nearMissCount,
				publicNonForkRepos: signals.scoreInput.publicNonForkRepoCount,
				publicForkRepos: signals.scoreInput.publicForkRepoCount,
				prsToThisRepo: signals.scoreInput.contextRepoPrCount,
				mergedPrs: signals.scoreInput.mergedPrCount,
				closedPrs: signals.scoreInput.closedPrCount,
				closedUnmergedPrs: signals.scoreInput.closedUnmergedPrCount,
				accountAgeDays: signals.scoreInput.accountAgeDays,
			},
			profile: {
				profileReadme: signals.scoreInput.hasProfileReadme,
				graphqlData: signals.scoreInput.graphql,
				achievements: signals.scoreInput.achievements,
			},
		};
	},
	chatRender: (output) => {
		const { ghUser, counts, profile, score, badges, status } = output;
		return makeSpec("UserCard", {
			username: ghUser.login,
			name: ghUser.name ?? null,
			avatar: ghUser.avatar_url ?? null,
			bio: ghUser.bio ?? null,
			company: ghUser.company ?? null,
			location: ghUser.location ?? null,
			publicRepos: ghUser.public_repos ?? 0,
			publicNonForkRepos: counts.publicNonForkRepos,
			publicForkRepos: counts.publicForkRepos,
			prsToThisRepo: counts.prsToThisRepo,
			followers: ghUser.followers ?? 0,
			following: ghUser.following ?? 0,
			accountAgeDays: counts.accountAgeDays,
			mergedPrs: counts.mergedPrs,
			closedPrs: counts.closedPrs,
			closedUnmergedPrs: counts.closedUnmergedPrs,
			hasProfileReadme: profile.profileReadme,
			hasTwoFactor: ghUser.two_factor_authentication ?? false,
			blockedCount: counts.blockedCount,
			allowedCount: counts.allowedCount,
			nearMissCount: counts.nearMissCount,
			orgs: profile.graphqlData?.organizations ?? [],
			sponsorsCount: profile.graphqlData?.sponsorsCount ?? 0,
			sponsoringCount: profile.graphqlData?.sponsoringCount ?? 0,
			achievements: profile.achievements,
			badges,
			contributionsLastYear: profile.graphqlData?.contributionsLastYear ?? 0,
			contributorScore: score.total,
			status,
		});
	},
});

// ─── score_breakdown ─────────────────────────────────────────────

const CATEGORY_META: Record<
	ScoreCategory,
	{ label: string; max: number | null }
> = {
	globalReputation: { label: "Global reputation", max: 40 },
	communitySignals: { label: "Community signals", max: 30 },
	repoHistory: { label: "Repo history", max: 20 },
	redFlags: { label: "Red flags", max: 0 },
	floor: { label: "Floor / clamp", max: null },
};

const scoreBreakdown = defineTool({
	name: "score_breakdown",
	description:
		"Explain a GitHub user's Tripwire contributor score by showing every contributing factor and its point delta. Use when the user asks why a score is what it is.",
	directInvokable: true,
	inputSchema: z.object({ username: z.string().min(1) }),
	handler: async ({ username }, ctx) => {
		const repoId = requireRepoId(ctx);
		const signals = await gatherUserSignals(username, ctx.userId, repoId);
		const score = computeContributorScore(signals.scoreInput);

		const subtotals: Record<ScoreCategory, number> = {
			globalReputation: score.globalReputation,
			communitySignals: score.communitySignals,
			repoHistory: score.repoHistory,
			redFlags: score.redFlags,
			floor: score.lineItems
				.filter((i) => i.category === "floor")
				.reduce((sum, i) => sum + i.delta, 0),
		};

		const order: ScoreCategory[] = [
			"globalReputation",
			"communitySignals",
			"repoHistory",
			"redFlags",
			"floor",
		];

		const categories = order
			.map((id) => {
				const items = score.lineItems
					.filter((i) => i.category === id)
					.map(({ reason, delta }) => ({ reason, delta }));
				if (id === "floor" && items.length === 0) return null;
				return {
					id,
					label: CATEGORY_META[id].label,
					subtotal: subtotals[id],
					max: CATEGORY_META[id].max,
					items,
				};
			})
			.filter((c): c is NonNullable<typeof c> => c !== null);

		return {
			username: signals.ghUser.login,
			total: score.total,
			categories,
		};
	},
	chatRender: (output) =>
		makeSpec("ScoreBreakdown", {
			username: output.username,
			total: output.total,
			categories: output.categories,
		}),
});

// ─── reputation_leaderboard ──────────────────────────────────────

const getReputationLeaderboard = defineTool({
	name: "get_reputation_leaderboard",
	description:
		"Show the most-blocked GitHub users across all events for the current repo. Use when asked about repeat offenders, most blocked users, or threat analysis.",
	surfaces: ["chat"],
	lazy: true,
	inputSchema: z.object({
		limit: z.number().int().min(1).max(25).optional(),
	}),
	handler: async ({ limit }, ctx) => {
		const repoId = requireRepoId(ctx);
		await assertRepoOwner(ctx.userId, repoId);
		return db
			.select()
			.from(githubReputation)
			.where(
				and(
					eq(githubReputation.repoId, repoId),
					sql`${githubReputation.totalBlocks} > 0`,
				),
			)
			.orderBy(desc(githubReputation.totalBlocks))
			.limit(limit ?? 10);
	},
	chatRender: (rows) =>
		makeSpec("ReputationLeaderboard", {
			users: rows.map((r) => ({
				username: r.githubUsername,
				score: r.score,
				totalBlocks: r.totalBlocks,
				totalAllows: r.totalAllows,
				totalNearMisses: r.totalNearMisses,
				lastSeenAt: fmtDate(r.lastSeenAt),
			})),
		}),
});

export const readTools: AnyToolDefinition[] = [
	listRepos,
	listEvents,
	getEvent,
	lookupUser,
	scoreBreakdown,
	getReputationLeaderboard,
];
