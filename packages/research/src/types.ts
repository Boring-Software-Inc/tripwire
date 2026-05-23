import type {
  ContributorCohort,
  PrCohort,
  ResearchRuleEvaluation,
} from "@tripwire/db/schema/research"
import type { GitHubUser, UserSignals } from "@tripwire/core/contributor-fetch"
import type { ScoreInput } from "@tripwire/core"

export type {
  ContributorCohort,
  PrCohort,
  GitHubUser,
  ResearchRuleEvaluation as RuleEvaluation,
}

export interface ProcessedContributor {
  username: string
  ghUser: GitHubUser | null
  accountCreatedAt: string | null
  accountAgeDays: number
  cohort: ContributorCohort
  status: UserSignals["status"]
  badges: string[]
  /** Full output of `resolveAllSignals` — 44 keyed signal values. */
  signals: Record<string, unknown>
  /** Full output of `computeContributorScore`. */
  score: Record<string, unknown>
  /** Real Tripwire rule evaluations applied to this contributor. */
  evaluations: ResearchRuleEvaluation[]
  /** Raw ScoreInput so consumers can re-derive anything downstream. */
  scoreInput: ScoreInput
  prCount: number
  fetchedAt: string
  error?: string
}

export interface ProcessedPr {
  prNumber: number
  repoFullName: string
  title: string
  body: string | null
  state: string
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
  timeToMergeMinutes: number | null
  additions: number
  deletions: number
  changedFiles: number
  commits: number
  selfClosed: boolean | null
  labels: Array<{ name: string; color: string }>
  cohort: PrCohort
  /** Real Tripwire content-rule evaluations applied to this PR's body. */
  ruleEvaluations: ResearchRuleEvaluation[]
}

export interface ProcessResult {
  contributor: ProcessedContributor
  prs: ProcessedPr[]
}

export interface ProcessOptions {
  cutoffDate: string
  prLimit?: number
  /** Optional repo context — runs the contributor through the repo's reputation slice. */
  contextRepoId?: string
  /** Optional configured language code for the language rule (defaults to "en"). */
  languageCode?: string
}
