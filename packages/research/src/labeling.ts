import type { ContributorCohort, PrCohort } from "@tripwire/db/schema/research"

export const DEFAULT_CUTOFF_DATE = "2022-11-30T00:00:00Z"

export function cohortForPr(
  prCreatedAt: string | Date,
  cutoffDate: string | Date
): PrCohort {
  const pr = prCreatedAt instanceof Date ? prCreatedAt : new Date(prCreatedAt)
  const cutoff = cutoffDate instanceof Date ? cutoffDate : new Date(cutoffDate)
  return pr < cutoff ? "pre_ai" : "post_ai"
}

export function cohortFromPrs(prs: { cohort: PrCohort }[]): ContributorCohort {
  if (prs.length === 0) return "post_ai_only"
  const hasPreAi = prs.some((p) => p.cohort === "pre_ai")
  const hasPostAi = prs.some((p) => p.cohort === "post_ai")
  if (hasPreAi && hasPostAi) return "spans_both"
  if (hasPreAi) return "pre_ai_only"
  return "post_ai_only"
}
