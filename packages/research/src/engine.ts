import { computeContributorScore } from "@tripwire/core"
import {
  fetchContributorSignals,
  type UserSignals,
} from "@tripwire/core/contributor-fetch"
import { resolveAllSignals } from "@tripwire/core/signals"
import type { SignalInput } from "@tripwire/core/signals"
import { BLOCKS } from "@tripwire/core/blocks"
import type { Block, EvalResult } from "@tripwire/core/blocks"
import type { RuleEvaluation } from "@tripwire/core/filter-pipeline"
import { fetchUserPRs } from "@tripwire/github/data-factory"
import { cohortForPr, cohortFromPrs } from "./labeling"
import type { ProcessOptions, ProcessResult, ProcessedPr } from "./types"

/**
 * Rule subtypes that consume contributor-level signals (account age, repo
 * counts, score, etc.). These get evaluated against the contributor's
 * resolved signal map.
 */
const CONTRIBUTOR_RULE_SUBTYPES = [
  "accountAge",
  "minMergedPrs",
  "requireProfileReadme",
  "repoActivityMinimum",
  "maxFilesChanged",
  "vouchedUsersOnly",
  "contributorScore",
] as const

/**
 * Rule subtypes that consume PR content text. Evaluated per-PR against the
 * PR body (or title fallback).
 */
const CONTENT_RULE_SUBTYPES = ["crypto", "language", "aiHoneypot"] as const

export async function processContributor(
  username: string,
  token: string,
  opts: ProcessOptions
): Promise<ProcessResult> {
  const signals = await fetchContributorSignals({
    username,
    token,
    contextRepoId: opts.contextRepoId,
  })

  const score = computeContributorScore(signals.scoreInput)

  const signalInput = scoreInputToSignalInput(signals, score.total)
  const flatSignals = resolveAllSignals(signalInput)

  const baseCtx: Record<string, unknown> = {
    ...flatSignals,
    isVouched: signals.status === "whitelisted",
    username,
  }

  const contributorEvaluations = CONTRIBUTOR_RULE_SUBTYPES.map((subtype) =>
    evaluateRuleBlock(subtype, {}, baseCtx)
  ).filter((e): e is RuleEvaluation => e !== null)

  const prResult = await fetchUserPRs(token, username, {
    limit: opts.prLimit ?? 100,
    state: "merged",
  })

  const languageCode = opts.languageCode ?? "en"

  const prs: ProcessedPr[] = prResult.items.map((pr) => {
    const body = pr.body ?? ""
    const prCtx: Record<string, unknown> = {
      ...baseCtx,
      contentText: body,
    }

    const ruleEvaluations = CONTENT_RULE_SUBTYPES.map((subtype) => {
      const data: Record<string, unknown> =
        subtype === "language" ? { params: { language: languageCode } } : {}
      return evaluateRuleBlock(subtype, data, prCtx)
    }).filter((e): e is RuleEvaluation => e !== null)

    return {
      prNumber: pr.number,
      repoFullName: pr.repoFullName,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      closedAt: pr.closedAt,
      timeToMergeMinutes: pr.timeToMergeMinutes,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      commits: pr.commits,
      selfClosed: pr.selfClosed,
      labels: pr.labels,
      cohort: cohortForPr(pr.createdAt, opts.cutoffDate),
      ruleEvaluations,
    }
  })

  const cohort = cohortFromPrs(prs)

  return {
    contributor: {
      username,
      ghUser: signals.ghUser,
      accountCreatedAt: signals.ghUser.created_at ?? null,
      accountAgeDays: signals.scoreInput.accountAgeDays,
      cohort,
      status: signals.status,
      badges: signals.badges,
      signals: flatSignals,
      score: score as unknown as Record<string, unknown>,
      evaluations: contributorEvaluations,
      scoreInput: signals.scoreInput,
      prCount: prs.length,
      fetchedAt: new Date().toISOString(),
    },
    prs,
  }
}

function evaluateRuleBlock(
  subtype: string,
  data: Record<string, unknown>,
  ctx: Record<string, unknown>
): RuleEvaluation | null {
  const block: Block | undefined = BLOCKS.find(
    (b) => b.type === "rule" && b.subtype === subtype
  )
  if (!block) return null
  const result: EvalResult = block.evaluate({ rule: subtype, ...data }, ctx)
  return {
    rule: subtype,
    passed: result.pass,
    nearMiss: false,
    reason: result.detail,
  }
}

function scoreInputToSignalInput(
  signals: UserSignals,
  scoreTotal: number
): SignalInput {
  const u = signals.ghUser
  return {
    ghUser: {
      login: u.login,
      id: u.id,
      type: "User",
      created_at: u.created_at,
      bio: u.bio,
      company: u.company,
      blog: u.blog,
      twitter_username: u.twitter_username,
      two_factor_authentication: u.two_factor_authentication,
      public_repos: u.public_repos,
      public_gists: u.public_gists,
      followers: u.followers,
      following: u.following,
    },
    repoReputation: {
      score: scoreTotal,
      totalBlocks: signals.scoreInput.blockedCount,
      totalAllows: signals.scoreInput.allowedCount,
      totalNearMisses: signals.scoreInput.nearMissCount,
      isWhitelisted: signals.status === "whitelisted",
      isBlacklisted: signals.status === "blacklisted",
    },
    enrichment: {
      graphql: signals.scoreInput.graphql,
      hasProfileReadme: signals.scoreInput.hasProfileReadme,
      achievementCount: signals.scoreInput.achievements.length,
      nonForkRepoCount: signals.scoreInput.publicNonForkRepoCount,
      forkRepoCount: signals.scoreInput.publicForkRepoCount,
      prTemporalData: signals.scoreInput.prTemporalData
        ? {
            creationIntervals:
              signals.scoreInput.prTemporalData.creationIntervals,
            timeToMerge: signals.scoreInput.prTemporalData.timeToMerge,
            maxPrsInOneHourWindow:
              signals.scoreInput.prTemporalData.maxPrsInOneHourWindow,
          }
        : null,
    },
  }
}
