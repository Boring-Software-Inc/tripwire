import { and, eq, sql } from "drizzle-orm"
import { createError } from "evlog"
import { db } from "@tripwire/db/client"
import {
  blacklistEntries,
  events,
  githubReputation,
  repositories,
  whitelistEntries,
} from "@tripwire/db"
import {
  fetchUserAchievements,
  fetchUserGraphQL,
  getClosedPrCount,
  getContextRepoPrCount,
  getMergedPrCount,
  getPublicForkRepoCount,
  getPublicNonForkRepoCount,
  hasProfileReadme,
} from "@tripwire/github"
import type { ScoreInput } from "./contributor-score"

export interface GitHubUser {
  login: string
  id: number
  name?: string | null
  avatar_url?: string | null
  bio?: string | null
  company?: string | null
  location?: string | null
  blog?: string | null
  twitter_username?: string | null
  public_repos?: number
  public_gists?: number
  followers?: number
  following?: number
  created_at?: string
  two_factor_authentication?: boolean
}

export interface UserSignals {
  ghUser: GitHubUser
  scoreInput: ScoreInput
  status: "normal" | "blacklisted" | "whitelisted"
  badges: string[]
}

export interface FetchContributorSignalsOpts {
  username: string
  /** PAT or installation token. Some endpoints work unauthenticated but rate limit is much tighter. */
  token: string | null
  /** Optional Tripwire repo id — when set, joins whitelist/blacklist/events/reputation for that repo. */
  contextRepoId?: string
}

export async function fetchGitHubUser(
  username: string,
  token?: string
): Promise<GitHubUser> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Tripwire",
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers,
  })
  if (!res.ok) {
    throw createError({
      code: "github.user_not_found",
      status: 404,
      message: `GitHub user @${username} not found`,
      internal: { username, githubStatus: res.status },
    })
  }
  return res.json() as Promise<GitHubUser>
}

/**
 * The full GH + DB fan-out that produces a ScoreInput ready for
 * `computeContributorScore` and `resolveAllSignals`. Used by:
 *   - the `lookup_user` chat tool (auth-gated via gatherUserSignals)
 *   - the research harness (admin-gated via the tRPC layer)
 *
 * `contextRepoId` opts a contributor into the per-repo reputation slice
 * (whitelist/blacklist/events/scoreResetAt). Omit it and the contributor
 * is evaluated globally (no Tripwire history applied).
 */
export async function fetchContributorSignals(
  opts: FetchContributorSignalsOpts
): Promise<UserSignals> {
  const { username, token, contextRepoId } = opts

  const contextRepoFullName = contextRepoId
    ? ((
        await db
          .select({ fullName: repositories.fullName })
          .from(repositories)
          .where(eq(repositories.id, contextRepoId))
          .limit(1)
      )[0]?.fullName ?? "")
    : ""

  const usernameEq = (column: unknown) =>
    sql`lower(${column}) = ${username.toLowerCase()}`

  const [
    ghUser,
    whitelist,
    blacklist,
    allEvents,
    reputationRow,
    mergedPrs,
    closedPrs,
    nonForkRepos,
    forkRepos,
    prsToThisRepo,
    profileReadme,
    graphqlData,
    achievements,
  ] = await Promise.all([
    fetchGitHubUser(username, token ?? undefined),
    contextRepoId
      ? db
          .select()
          .from(whitelistEntries)
          .where(
            and(
              eq(whitelistEntries.repoId, contextRepoId),
              usernameEq(whitelistEntries.githubUsername)
            )
          )
          .limit(1)
      : Promise.resolve([] as Array<typeof whitelistEntries.$inferSelect>),
    contextRepoId
      ? db
          .select()
          .from(blacklistEntries)
          .where(
            and(
              eq(blacklistEntries.repoId, contextRepoId),
              usernameEq(blacklistEntries.githubUsername)
            )
          )
          .limit(1)
      : Promise.resolve([] as Array<typeof blacklistEntries.$inferSelect>),
    contextRepoId
      ? db
          .select()
          .from(events)
          .where(
            and(
              eq(events.repoId, contextRepoId),
              usernameEq(events.targetGithubUsername)
            )
          )
      : Promise.resolve([] as Array<typeof events.$inferSelect>),
    contextRepoId
      ? db
          .select({ scoreResetAt: githubReputation.scoreResetAt })
          .from(githubReputation)
          .where(
            and(
              eq(githubReputation.repoId, contextRepoId),
              sql`lower(${githubReputation.githubUsername}) = ${username.toLowerCase()}`
            )
          )
          .limit(1)
      : Promise.resolve([] as Array<{ scoreResetAt: Date | null }>),
    token
      ? getMergedPrCount(token, username).catch(() => 0)
      : Promise.resolve(0),
    token
      ? getClosedPrCount(token, username).catch(() => 0)
      : Promise.resolve(0),
    token
      ? getPublicNonForkRepoCount(token, username).catch(() => 0)
      : Promise.resolve(0),
    token
      ? getPublicForkRepoCount(token, username).catch(() => 0)
      : Promise.resolve(0),
    token && contextRepoFullName
      ? getContextRepoPrCount(token, username, contextRepoFullName).catch(
          () => 0
        )
      : Promise.resolve(0),
    token
      ? hasProfileReadme(token, username).catch(() => false)
      : Promise.resolve(false),
    token
      ? fetchUserGraphQL(token, username).catch(() => null)
      : Promise.resolve(null),
    fetchUserAchievements(username).catch(() => []),
  ])

  const scoreResetAt = reputationRow[0]?.scoreResetAt ?? null
  const countsAfterReset = scoreResetAt
    ? allEvents.filter((e) => e.createdAt > scoreResetAt)
    : allEvents

  const closedUnmergedPrs = Math.max(0, closedPrs - mergedPrs)
  const blockedCount = countsAfterReset.filter(
    (e) => e.action === "pipeline_blocked"
  ).length
  const allowedCount = countsAfterReset.filter(
    (e) => e.action === "pipeline_allowed"
  ).length
  const nearMissCount = countsAfterReset.filter(
    (e) => e.action === "rule_near_miss"
  ).length
  const createdAt = ghUser.created_at ? new Date(ghUser.created_at) : new Date()
  const accountAgeDays = Math.floor(
    (Date.now() - createdAt.getTime()) / 86_400_000
  )

  const badges: string[] = []
  if (graphqlData?.isGitHubStar) badges.push("GitHub Star")
  if (graphqlData?.isBountyHunter) badges.push("Bug Bounty Hunter")
  if (graphqlData?.isDeveloperProgramMember) badges.push("Dev Program")
  if (graphqlData?.isCampusExpert) badges.push("Campus Expert")
  if (graphqlData?.isSiteAdmin) badges.push("GitHub Staff")

  const status: UserSignals["status"] =
    blacklist.length > 0
      ? "blacklisted"
      : whitelist.length > 0
        ? "whitelisted"
        : "normal"

  const repoEvents = countsAfterReset
    .filter((e) =>
      [
        "pipeline_allowed",
        "pipeline_blocked",
        "rule_near_miss",
        "block_cleared",
      ].includes(e.action)
    )
    .map((e) => ({
      type: (e.action === "pipeline_allowed"
        ? "allowed"
        : e.action === "pipeline_blocked"
          ? "blocked"
          : e.action === "block_cleared"
            ? "cleared"
            : "near-miss") as "allowed" | "blocked" | "near-miss" | "cleared",
      createdAt: e.createdAt,
    }))

  let mergedPrSummary: { total: number; qualityWeightedCount: number } | null =
    null
  let prTemporalData: {
    creationIntervals: number[]
    timeToMerge: number[]
    distinctRepoCount: number
    maxPrsInOneHourWindow: number
    reposInDensestWindow: number
  } | null = null

  if (token && mergedPrs > 0) {
    try {
      const { fetchUserPRs } = await import("@tripwire/github/data-factory")
      const prResult = await fetchUserPRs(token, username, {
        limit: 100,
        state: "merged",
      })
      const prs = prResult.items

      if (prs.length > 0) {
        let qualityWeightedCount = 0
        const repoSet = new Set<string>()
        for (const pr of prs) {
          repoSet.add(pr.repoFullName)
          const isOwnRepo = pr.repoFullName
            .toLowerCase()
            .startsWith(username.toLowerCase() + "/")
          qualityWeightedCount += isOwnRepo ? 0.25 : 0.5
        }
        const sampleRatio = mergedPrs > 0 ? prs.length / mergedPrs : 1
        const extrapolatedQuality =
          sampleRatio > 0
            ? qualityWeightedCount / sampleRatio
            : qualityWeightedCount

        mergedPrSummary = {
          total: mergedPrs,
          qualityWeightedCount: Math.round(extrapolatedQuality * 10) / 10,
        }

        const timestamps = prs
          .map((pr) => new Date(pr.createdAt).getTime())
          .filter((t) => !isNaN(t))
          .sort((a, b) => a - b)

        const creationIntervals: number[] = []
        for (let i = 1; i < timestamps.length; i++) {
          creationIntervals.push((timestamps[i] - timestamps[i - 1]) / 1000)
        }

        const timeToMerge = prs
          .filter((pr) => pr.mergedAt && pr.createdAt)
          .map(
            (pr) =>
              (new Date(pr.mergedAt!).getTime() -
                new Date(pr.createdAt).getTime()) /
              1000
          )
          .filter((t) => t >= 0)

        let maxPrsInWindow = 0
        let reposInDensestWindow = 0
        const HOUR_MS = 3_600_000
        for (let i = 0; i < timestamps.length; i++) {
          const windowEnd = timestamps[i] + HOUR_MS
          let count = 0
          const windowRepos = new Set<string>()
          for (
            let j = i;
            j < timestamps.length && timestamps[j] <= windowEnd;
            j++
          ) {
            count++
            windowRepos.add(prs[j]?.repoFullName ?? "")
          }
          if (count > maxPrsInWindow) {
            maxPrsInWindow = count
            reposInDensestWindow = windowRepos.size
          }
        }

        prTemporalData = {
          creationIntervals,
          timeToMerge,
          distinctRepoCount: repoSet.size,
          maxPrsInOneHourWindow: maxPrsInWindow,
          reposInDensestWindow,
        }
      }
    } catch {
      // Data factory unavailable — degrade gracefully, use flat counts
    }
  }

  return {
    ghUser,
    scoreInput: {
      accountAgeDays,
      followers: ghUser.followers ?? 0,
      following: ghUser.following ?? 0,
      publicRepos: ghUser.public_repos ?? 0,
      publicNonForkRepoCount: nonForkRepos,
      publicForkRepoCount: forkRepos,
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
      mergedPrSummary,
      prTemporalData,
      repoEvents: repoEvents.length > 0 ? repoEvents : null,
    },
    status,
    badges,
  }
}
