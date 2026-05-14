/**
 * Contributor trust score (0-100) based on GitHub profile signals,
 * Tripwire event history, and community standing.
 *
 * Four categories:
 * - globalReputation (0-40): account age, followers, merged PRs, closed PR merge ratio, non-fork public repos (capped), context-repo PRs, achievements
 * - communitySignals (0-30): orgs, sponsors, badges, social accounts, 2FA, bio
 * - repoHistory (0-20): tripwire events (allowed/blocked/near-miss ratio)
 * - redFlags (0 to -10): high blocked ratio, suspicious patterns
 */

import type { GitHubAchievement, GitHubUserGraphQL } from '@tripwire/github';

export interface ScoreInput {
	accountAgeDays: number;
	followers: number;
	following: number;
	/** GitHub profile public_repo count (incl. forks); used for floors / display parity */
	publicRepos: number;
	/** Public non-fork repos (search); primary repo substance signal */
	publicNonForkRepoCount: number;
	/** Public fork repos (search); ratio / transparency */
	publicForkRepoCount: number;
	/** PRs authored on the Tripwire-connected repo */
	contextRepoPrCount: number;
	publicGists: number;
	bio: string | null;
	company: string | null;
	location: string | null;
	blog: string | null;
	twitterUsername: string | null;
	hasTwoFactor: boolean;
	hasProfileReadme: boolean;
	graphql: GitHubUserGraphQL | null;
	achievements: GitHubAchievement[];
	mergedPrCount: number;
	/** Total closed PRs authored (includes merged and closed-unmerged) */
	closedPrCount: number;
	/** Closed PRs that were not merged (subset of closedPrCount) */
	closedUnmergedPrCount: number;
	blockedCount: number;
	allowedCount: number;
	nearMissCount: number;
}

export type ScoreCategory =
	| "globalReputation"
	| "communitySignals"
	| "repoHistory"
	| "redFlags"
	| "floor";

export interface ScoreLineItem {
	category: ScoreCategory;
	reason: string;
	delta: number;
}

export interface ScoreResult {
	total: number;
	globalReputation: number;
	communitySignals: number;
	repoHistory: number;
	redFlags: number;
	lineItems: ScoreLineItem[];
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

// ─── Line-item collector ─────────────────────────────────────────

class CategoryBuilder {
	total = 0;
	constructor(
		private readonly category: ScoreCategory,
		private readonly sink: ScoreLineItem[],
	) {}
	add(reason: string, delta: number) {
		if (delta === 0) return;
		this.total += delta;
		this.sink.push({ category: this.category, reason, delta });
	}
}

// ─── Achievement scoring ─────────────────────────────────────────

const TIER_POINTS: Record<number, number> = {
	1: 1,
	2: 2,
	3: 4,
	4: 6,
};

const RARITY_MULTIPLIER: Record<string, number> = {
	starstruck: 2,
	"arctic-code-vault-contributor": 2,
	"pull-shark": 1.5,
	"galaxy-brain": 1.5,
	"public-sponsor": 1.5,
	"pair-extraordinaire": 1,
	"open-sourcerer": 1,
	"heart-on-your-sleeve": 1,
	"mars-2020-contributor": 2,
	yolo: 0.5,
	quickdraw: 0.5,
};

function achievementPoints(a: GitHubAchievement): number {
	const tierPts = TIER_POINTS[a.tier] ?? 1;
	const rarity = RARITY_MULTIPLIER[a.type] ?? 1;
	return tierPts * rarity;
}

// ─── Helpers ─────────────────────────────────────────────────────

export function formatAccountAge(days: number): string {
	if (days < 30) return `${days}d`;
	if (days < 365) return `${Math.floor(days / 30)}mo`;
	const years = Math.floor(days / 365);
	const months = Math.floor((days % 365) / 30);
	return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

// ─── Category scorers ────────────────────────────────────────────

function scoreGlobalReputation(input: ScoreInput, sink: ScoreLineItem[]): number {
	const b = new CategoryBuilder("globalReputation", sink);
	const days = input.accountAgeDays;
	const ageLabel = formatAccountAge(days);
	b.add(
		`Account age ${ageLabel}`,
		days >= 5475 ? 15
			: days >= 3650 ? 12
			: days >= 1825 ? 10
			: days >= 1095 ? 8
			: days >= 365 ? 5
			: days >= 90 ? 2
			: 0,
	);

	const f = input.followers;
	b.add(
		`Followers ${f}`,
		f >= 500 ? 8 : f >= 100 ? 6 : f >= 20 ? 4 : f >= 5 ? 2 : 0,
	);

	const prs = input.mergedPrCount;
	b.add(
		`Merged PRs ${prs}`,
		prs >= 500 ? 12 : prs >= 200 ? 10 : prs >= 50 ? 8 : prs >= 10 ? 5 : prs >= 1 ? 2 : 0,
	);

	const repos = input.publicNonForkRepoCount;
	b.add(
		`Non-fork public repos ${repos}`,
		repos >= 50 ? 4 : repos >= 20 ? 3 : repos >= 5 ? 2 : repos >= 1 ? 1 : 0,
	);

	b.add(
		`Authored PRs to this repo (${input.contextRepoPrCount})`,
		input.contextRepoPrCount >= 5 ? 2 : input.contextRepoPrCount >= 1 ? 1 : 0,
	);

	b.add(
		`Following ${input.following}`,
		input.following >= 50 ? 2 : input.following >= 10 ? 1 : 0,
	);

	b.add(
		`Public gists ${input.publicGists}`,
		input.publicGists >= 5 ? 2 : input.publicGists >= 1 ? 1 : 0,
	);

	const closed = input.closedPrCount;
	if (closed >= 10) {
		const mergedRatio = input.mergedPrCount / closed;
		const pct = Math.round(mergedRatio * 100);
		b.add(
			`Merged/closed PR ratio ${pct}% (${input.mergedPrCount}/${closed})`,
			mergedRatio >= 0.7 ? 3
				: mergedRatio >= 0.55 ? 2
				: mergedRatio >= 0.4 ? 1
				: mergedRatio < 0.15 ? -3
				: mergedRatio < 0.25 ? -2
				: mergedRatio < 0.35 ? -1
				: 0,
		);
	}

	const raw = b.total;
	const clamped = clamp(raw, 0, 40);
	if (raw > clamped) {
		sink.push({
			category: "globalReputation",
			reason: `Capped at 40 (raw ${raw})`,
			delta: clamped - raw,
		});
	}
	return clamped;
}

function scoreCommunitySignals(input: ScoreInput, sink: ScoreLineItem[]): number {
	const b = new CategoryBuilder("communitySignals", sink);

	let achievementTotal = 0;
	for (const a of input.achievements) {
		const pts = achievementPoints(a);
		achievementTotal += pts;
		b.add(`Achievement: ${a.type} (tier ${a.tier})`, pts);
	}
	if (achievementTotal > 20) {
		b.add("Achievements capped at 20", 20 - achievementTotal);
	}

	if (input.graphql?.sponsoringCount && input.graphql.sponsoringCount > 0) {
		b.add(`Sponsoring ${input.graphql.sponsoringCount} user(s)`, 4);
	}
	if (input.graphql?.sponsorsCount && input.graphql.sponsorsCount > 0) {
		b.add(`Has ${input.graphql.sponsorsCount} sponsor(s)`, 5);
	}
	if (input.graphql?.hasSponsorsListing) {
		b.add("Has GitHub Sponsors listing", 2);
	}

	const orgCount = input.graphql?.organizations.length ?? 0;
	b.add(`Org memberships ${orgCount}`, orgCount >= 3 ? 3 : orgCount >= 1 ? 2 : 0);

	if (input.graphql?.isGitHubStar) b.add("GitHub Star badge", 4);
	if (input.graphql?.isBountyHunter) b.add("Bug Bounty Hunter badge", 3);
	if (input.graphql?.isDeveloperProgramMember) b.add("Developer Program member", 2);
	if (input.graphql?.isCampusExpert) b.add("Campus Expert", 2);
	if (input.graphql?.isSiteAdmin) b.add("GitHub Staff", 5);

	const socials = input.graphql?.socialAccounts.length ?? 0;
	if (socials > 0) b.add(`Social accounts ${socials}`, Math.min(socials, 2));
	if (input.bio) b.add("Has bio", 1);
	if (input.company) b.add("Has company", 1);
	if (input.blog) b.add("Has blog", 1);
	if (input.twitterUsername) b.add("Has Twitter", 1);
	if (input.hasTwoFactor) b.add("2FA enabled", 2);
	if (input.hasProfileReadme) b.add("Has profile README", 1);

	const raw = b.total;
	const clamped = clamp(raw, 0, 30);
	if (raw > clamped) {
		sink.push({
			category: "communitySignals",
			reason: `Capped at 30 (raw ${raw})`,
			delta: clamped - raw,
		});
	}
	return clamped;
}

function scoreRepoHistory(input: ScoreInput, sink: ScoreLineItem[]): number {
	const total = input.blockedCount + input.allowedCount + input.nearMissCount;

	if (total === 0) {
		sink.push({
			category: "repoHistory",
			reason: "No repo history (neutral baseline)",
			delta: 10,
		});
		return 10;
	}

	const b = new CategoryBuilder("repoHistory", sink);
	b.add("Baseline", 10);

	const allowedPts = Math.min(input.allowedCount * 2, 10);
	if (allowedPts > 0) {
		b.add(`${input.allowedCount} allowed events (+2 each, cap 10)`, allowedPts);
	}

	if (input.blockedCount > 0) {
		b.add(`${input.blockedCount} blocked events (-3 each)`, -3 * input.blockedCount);
	}

	if (input.nearMissCount > 0) {
		b.add(`${input.nearMissCount} near-miss events (-1 each)`, -input.nearMissCount);
	}

	const raw = b.total;
	const clamped = clamp(raw, 0, 20);
	if (raw !== clamped) {
		sink.push({
			category: "repoHistory",
			reason: `Clamped to [0, 20] (raw ${raw})`,
			delta: clamped - raw,
		});
	}
	return clamped;
}

function scoreRedFlags(input: ScoreInput, sink: ScoreLineItem[]): number {
	const b = new CategoryBuilder("redFlags", sink);

	const total = input.blockedCount + input.allowedCount;
	if (total > 0) {
		const blockedRatio = input.blockedCount / total;
		const pct = Math.round(blockedRatio * 100);
		if (blockedRatio > 0.75) b.add(`Blocked ratio ${pct}%`, -8);
		else if (blockedRatio > 0.5) b.add(`Blocked ratio ${pct}%`, -5);
		else if (blockedRatio > 0.25) b.add(`Blocked ratio ${pct}%`, -3);
	}

	if (input.accountAgeDays < 30 && input.mergedPrCount === 0 && input.publicRepos <= 1) {
		b.add("Brand-new account with no activity", -3);
	}

	if (input.followers === 0 && input.following === 0 && input.accountAgeDays < 365) {
		b.add("Zero followers + zero following on new-ish account", -2);
	}

	if (input.closedPrCount >= 30) {
		const mergedRatio = input.mergedPrCount / input.closedPrCount;
		const pct = Math.round(mergedRatio * 100);
		if (mergedRatio < 0.08) b.add(`Very low merge ratio ${pct}% across ${input.closedPrCount} PRs`, -3);
		else if (mergedRatio < 0.12) b.add(`Low merge ratio ${pct}% across ${input.closedPrCount} PRs`, -2);
	}

	if (input.publicForkRepoCount >= 50 && input.publicNonForkRepoCount <= 2) {
		b.add(`Fork-heavy profile (${input.publicForkRepoCount} forks, ${input.publicNonForkRepoCount} non-fork)`, -1);
	}

	const raw = b.total;
	const clamped = clamp(raw, -10, 0);
	if (raw !== clamped) {
		sink.push({
			category: "redFlags",
			reason: `Clamped to [-10, 0] (raw ${raw})`,
			delta: clamped - raw,
		});
	}
	return clamped;
}

// ─── Main ────────────────────────────────────────────────────────

export function computeContributorScore(input: ScoreInput): ScoreResult {
	const lineItems: ScoreLineItem[] = [];

	const globalReputation = scoreGlobalReputation(input, lineItems);
	const communitySignals = scoreCommunitySignals(input, lineItems);
	const repoHistory = scoreRepoHistory(input, lineItems);
	const redFlags = scoreRedFlags(input, lineItems);

	let raw = globalReputation + communitySignals + repoHistory + redFlags;
	if (input.accountAgeDays >= 3650 && input.publicRepos >= 1 && raw < 45) {
		lineItems.push({
			category: "floor",
			reason: "Longevity floor: 10+ years with activity",
			delta: 45 - raw,
		});
		raw = 45;
	} else if (input.accountAgeDays >= 1825 && input.publicRepos >= 3 && raw < 35) {
		lineItems.push({
			category: "floor",
			reason: "Longevity floor: 5+ years with 3+ repos",
			delta: 35 - raw,
		});
		raw = 35;
	}

	const total = clamp(raw, 0, 100);
	if (raw !== total) {
		lineItems.push({
			category: "floor",
			reason: `Final clamp to [0, 100] (raw ${raw})`,
			delta: total - raw,
		});
	}

	return {
		total,
		globalReputation,
		communitySignals,
		repoHistory,
		redFlags,
		lineItems,
	};
}
