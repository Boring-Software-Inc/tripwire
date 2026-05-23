import { SIGNALS } from "@tripwire/core/signals"
import type { ProcessResult, RuleEvaluation } from "./types"

const CONTRIBUTOR_META_COLUMNS = [
  "username",
  "accountCreatedAt",
  "accountAgeDays",
  "cohort",
  "status",
  "prCount",
  "fetchedAt",
  "error",
] as const

const CONTRIBUTOR_RULE_COLUMNS = [
  "accountAge",
  "minMergedPrs",
  "requireProfileReadme",
  "repoActivityMinimum",
  "maxFilesChanged",
  "vouchedUsersOnly",
  "contributorScore",
] as const

const PR_RULE_COLUMNS = ["crypto", "language", "aiHoneypot"] as const

const PR_META_COLUMNS = [
  "username",
  "prNumber",
  "repoFullName",
  "title",
  "state",
  "createdAt",
  "mergedAt",
  "closedAt",
  "timeToMergeMinutes",
  "additions",
  "deletions",
  "changedFiles",
  "commits",
  "selfClosed",
  "cohort",
] as const

function findEval(
  evaluations: RuleEvaluation[],
  rule: string
): RuleEvaluation | undefined {
  return evaluations.find((e) => e.rule === rule)
}

export function contributorsCsvHeader(): string {
  const signalCols = SIGNALS.map((s) => s.id)
  const ruleCols = CONTRIBUTOR_RULE_COLUMNS.flatMap((r) => [
    `${r}_passed`,
    `${r}_detail`,
  ])
  return csvRow([...CONTRIBUTOR_META_COLUMNS, ...signalCols, ...ruleCols])
}

export function contributorsToCsv(results: ProcessResult[]): string {
  const lines = [contributorsCsvHeader()]
  for (const { contributor } of results) {
    const meta = [
      contributor.username,
      contributor.accountCreatedAt,
      contributor.accountAgeDays,
      contributor.cohort,
      contributor.status,
      contributor.prCount,
      contributor.fetchedAt,
      contributor.error ?? "",
    ]
    const signals = SIGNALS.map((s) => contributor.signals[s.id] ?? "")
    const ruleCells = CONTRIBUTOR_RULE_COLUMNS.flatMap((r) => {
      const ev = findEval(contributor.evaluations, r)
      return [ev?.passed ?? "", ev?.reason ?? ""]
    })
    lines.push(csvRow([...meta, ...signals, ...ruleCells]))
  }
  return lines.join("\n") + "\n"
}

export function prsCsvHeader(): string {
  const ruleCols = PR_RULE_COLUMNS.flatMap((r) => [
    `${r}_passed`,
    `${r}_detail`,
  ])
  return csvRow([...PR_META_COLUMNS, ...ruleCols])
}

export function prsToCsv(results: ProcessResult[]): string {
  const lines = [prsCsvHeader()]
  for (const { contributor, prs } of results) {
    for (const pr of prs) {
      const ruleCells = PR_RULE_COLUMNS.flatMap((r) => {
        const ev = findEval(pr.ruleEvaluations, r)
        return [ev?.passed ?? "", ev?.reason ?? ""]
      })
      lines.push(
        csvRow([
          contributor.username,
          pr.prNumber,
          pr.repoFullName,
          pr.title,
          pr.state,
          pr.createdAt,
          pr.mergedAt,
          pr.closedAt,
          pr.timeToMergeMinutes,
          pr.additions,
          pr.deletions,
          pr.changedFiles,
          pr.commits,
          pr.selfClosed,
          pr.cohort,
          ...ruleCells,
        ])
      )
    }
  }
  return lines.join("\n") + "\n"
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = typeof value === "string" ? value : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvEscape).join(",")
}
