export interface BountyRequirementCriterion {
  id: string
  text: string
  sourceHeading: string
}

export interface BountyRequirementMatch {
  criterion: BountyRequirementCriterion
  matchedTerms: string[]
}

export interface BountyRequirementValidation {
  status: "no_criteria" | "valid" | "missing_requirements"
  coverage: number
  requiredCount: number
  matched: BountyRequirementMatch[]
  missing: BountyRequirementCriterion[]
}

const REQUIREMENT_HEADINGS = new Set([
  "acceptance criteria",
  "criteria",
  "requirements",
  "technical constraints",
  "constraints",
  "fix",
  "expected outcome",
  "expected behavior",
])

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "must",
  "of",
  "on",
  "or",
  "should",
  "that",
  "the",
  "to",
  "with",
])

function normalizeHeading(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/[:#*_`~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeCriterion(line: string): string {
  return line
    .replace(/^\s*(?:[-*+]|\d+[.)]|\[[ xX]\])\s*/, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function criterionTerms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/`[^`]+`/g, " ")
        .replace(/[^a-z0-9_]+/g, " ")
        .split(/\s+/)
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
    )
  )
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)]|[-*+]\s+\[[ xX]\])\s+\S/.test(line)
}

function looksLikeRequirementHeading(line: string): boolean {
  const heading = normalizeHeading(line)
  return REQUIREMENT_HEADINGS.has(heading)
}

export function extractBountyRequirementCriteria(
  body: string
): BountyRequirementCriterion[] {
  const criteria: BountyRequirementCriterion[] = []
  const lines = body.split(/\r?\n/)
  let activeHeading: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^#{1,6}\s+/.test(line) || /^[A-Z][A-Za-z ]+:$/.test(line)) {
      activeHeading = looksLikeRequirementHeading(line)
        ? normalizeHeading(line)
        : null
      continue
    }

    if (!activeHeading || !isListItem(rawLine)) continue

    const text = normalizeCriterion(rawLine)
    const terms = criterionTerms(text)
    if (text && terms.length > 0) {
      criteria.push({
        id: `${activeHeading}-${criteria.length + 1}`,
        text,
        sourceHeading: activeHeading,
      })
    }
  }

  return criteria
}

function criterionMatchesSubmission(
  criterion: BountyRequirementCriterion,
  submissionTerms: Set<string>
): BountyRequirementMatch | null {
  const terms = criterionTerms(criterion.text)
  if (terms.length === 0) return null

  const matchedTerms = terms.filter((term) => submissionTerms.has(term))
  const requiredMatches = terms.length <= 3 ? 1 : Math.ceil(terms.length * 0.4)

  if (matchedTerms.length < requiredMatches) return null

  return { criterion, matchedTerms }
}

export function validateBountySubmissionRequirements(opts: {
  bountyBody: string
  submissionText: string
}): BountyRequirementValidation {
  const criteria = extractBountyRequirementCriteria(opts.bountyBody)
  if (criteria.length === 0) {
    return {
      status: "no_criteria",
      coverage: 1,
      requiredCount: 0,
      matched: [],
      missing: [],
    }
  }

  const submissionTerms = new Set(criterionTerms(opts.submissionText))
  const matched: BountyRequirementMatch[] = []
  const missing: BountyRequirementCriterion[] = []

  for (const criterion of criteria) {
    const match = criterionMatchesSubmission(criterion, submissionTerms)
    if (match) matched.push(match)
    else missing.push(criterion)
  }

  const coverage = matched.length / criteria.length
  const status = missing.length === 0 ? "valid" : "missing_requirements"

  return {
    status,
    coverage,
    requiredCount: criteria.length,
    matched,
    missing,
  }
}
