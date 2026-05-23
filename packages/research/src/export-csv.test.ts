import { describe, it, expect } from "vitest"
import { SIGNALS } from "@tripwire/core/signals"
import {
  contributorsCsvHeader,
  contributorsToCsv,
  csvEscape,
  csvRow,
  prsCsvHeader,
  prsToCsv,
} from "./export-csv"
import type { ProcessResult } from "./types"

function makeContributor(
  overrides: Partial<ProcessResult["contributor"]> = {}
): ProcessResult["contributor"] {
  return {
    username: "u",
    ghUser: null,
    accountCreatedAt: null,
    accountAgeDays: 0,
    cohort: "post_ai_only",
    status: "normal",
    badges: [],
    signals: {},
    score: {},
    evaluations: [],
    scoreInput: {} as ProcessResult["contributor"]["scoreInput"],
    prCount: 0,
    fetchedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

function makePr(
  overrides: Partial<ProcessResult["prs"][number]> = {}
): ProcessResult["prs"][number] {
  return {
    prNumber: 1,
    repoFullName: "a/b",
    title: "x",
    body: null,
    state: "open",
    createdAt: "2024-01-01T00:00:00Z",
    mergedAt: null,
    closedAt: null,
    timeToMergeMinutes: null,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    commits: 0,
    selfClosed: null,
    labels: [],
    cohort: "post_ai",
    ruleEvaluations: [],
    ...overrides,
  }
}

describe("csvEscape", () => {
  it("returns empty string for null/undefined", () => {
    expect(csvEscape(null)).toBe("")
    expect(csvEscape(undefined)).toBe("")
  })

  it("returns numbers and booleans as plain text", () => {
    expect(csvEscape(42)).toBe("42")
    expect(csvEscape(true)).toBe("true")
    expect(csvEscape(false)).toBe("false")
  })

  it("does not quote simple strings", () => {
    expect(csvEscape("hello")).toBe("hello")
  })

  it("quotes strings with commas, newlines, or quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"')
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"')
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""')
  })
})

describe("csvRow", () => {
  it("joins values with commas", () => {
    expect(csvRow(["a", 1, true])).toBe("a,1,true")
  })

  it("escapes individual cells correctly", () => {
    expect(csvRow(["normal", "has,comma", 'has"quote'])).toBe(
      'normal,"has,comma","has""quote"'
    )
  })
})

describe("contributors CSV", () => {
  it("header has meta columns + every signal + per-rule passed+detail columns", () => {
    const header = contributorsCsvHeader()
    const cols = header.split(",")
    expect(cols).toContain("username")
    expect(cols).toContain("cohort")
    expect(cols).toContain("status")
    for (const signal of SIGNALS) expect(cols).toContain(signal.id)
    expect(cols).toContain("accountAge_passed")
    expect(cols).toContain("accountAge_detail")
    expect(cols).toContain("contributorScore_passed")
  })

  it("emits passed + detail cells per rule from evaluations", () => {
    const results: ProcessResult[] = [
      {
        contributor: makeContributor({
          username: "grim",
          accountAgeDays: 365,
          cohort: "spans_both",
          signals: { accountAgeDays: 365 },
          evaluations: [
            {
              rule: "accountAge",
              passed: true,
              nearMiss: false,
              reason: "PASS -- account is 365d old (requires >= 30d)",
            },
            {
              rule: "minMergedPrs",
              passed: false,
              nearMiss: false,
              reason: "FAIL -- 0 merged PRs (requires >= 15)",
            },
          ],
        }),
        prs: [],
      },
    ]
    const csv = contributorsToCsv(results)
    expect(csv).toContain("grim")
    expect(csv).toContain("PASS -- account is 365d old")
    expect(csv).toContain("FAIL -- 0 merged PRs")
  })
})

describe("PRs CSV", () => {
  it("header lists meta cols + crypto/language/aiHoneypot passed+detail", () => {
    const cols = prsCsvHeader().split(",")
    expect(cols).toContain("username")
    expect(cols).toContain("prNumber")
    expect(cols).toContain("cohort")
    expect(cols).toContain("crypto_passed")
    expect(cols).toContain("crypto_detail")
    expect(cols).toContain("language_passed")
    expect(cols).toContain("aiHoneypot_passed")
  })

  it("emits rule evaluation cells per PR", () => {
    const results: ProcessResult[] = [
      {
        contributor: makeContributor({ username: "grim" }),
        prs: [
          makePr({
            prNumber: 7,
            repoFullName: "foo/bar",
            title: "Add feature",
            ruleEvaluations: [
              {
                rule: "crypto",
                passed: true,
                nearMiss: false,
                reason: "PASS -- no crypto addresses found",
              },
              {
                rule: "language",
                passed: true,
                nearMiss: false,
                reason: "PASS -- content matches language: en",
              },
            ],
          }),
        ],
      },
    ]
    const csv = prsToCsv(results)
    expect(csv).toContain("grim")
    expect(csv).toContain("foo/bar")
    expect(csv).toContain("PASS -- no crypto addresses found")
    expect(csv).toContain("PASS -- content matches language: en")
  })

  it("escapes PR titles with commas and quotes", () => {
    const results: ProcessResult[] = [
      {
        contributor: makeContributor(),
        prs: [makePr({ title: 'Fix bug, also added "thing"' })],
      },
    ]
    expect(prsToCsv(results)).toContain('"Fix bug, also added ""thing"""')
  })
})
