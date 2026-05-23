import type { ProcessResult, RuleEvaluation } from "./types"

export interface JsonlContributorRecord {
  type: "contributor"
  username: string
  accountCreatedAt: string | null
  accountAgeDays: number
  cohort: string
  status: string
  badges: string[]
  prCount: number
  fetchedAt: string
  signals: Record<string, unknown>
  score: Record<string, unknown>
  evaluations: RuleEvaluation[]
  error?: string
}

export interface JsonlPrRecord {
  type: "pr"
  username: string
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
  cohort: string
  ruleEvaluations: RuleEvaluation[]
}

export function* iterJsonlContributors(
  results: ProcessResult[]
): Generator<string> {
  for (const { contributor } of results) {
    const record: JsonlContributorRecord = {
      type: "contributor",
      username: contributor.username,
      accountCreatedAt: contributor.accountCreatedAt,
      accountAgeDays: contributor.accountAgeDays,
      cohort: contributor.cohort,
      status: contributor.status,
      badges: contributor.badges,
      prCount: contributor.prCount,
      fetchedAt: contributor.fetchedAt,
      signals: contributor.signals,
      score: contributor.score,
      evaluations: contributor.evaluations,
      ...(contributor.error ? { error: contributor.error } : {}),
    }
    yield JSON.stringify(record)
  }
}

export function* iterJsonlPrs(results: ProcessResult[]): Generator<string> {
  for (const { contributor, prs } of results) {
    for (const pr of prs) {
      const record: JsonlPrRecord = {
        type: "pr",
        username: contributor.username,
        prNumber: pr.prNumber,
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
        cohort: pr.cohort,
        ruleEvaluations: pr.ruleEvaluations,
      }
      yield JSON.stringify(record)
    }
  }
}

export function toJsonl(results: ProcessResult[]): string {
  const lines: string[] = []
  for (const line of iterJsonlContributors(results)) lines.push(line)
  for (const line of iterJsonlPrs(results)) lines.push(line)
  return lines.join("\n") + "\n"
}
