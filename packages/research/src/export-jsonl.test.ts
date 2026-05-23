import { describe, it, expect } from "vitest"
import { iterJsonlContributors, iterJsonlPrs, toJsonl } from "./export-jsonl"
import type { ProcessResult } from "./types"

const result: ProcessResult = {
  contributor: {
    username: "grim",
    ghUser: null,
    accountCreatedAt: "2020-01-01T00:00:00Z",
    accountAgeDays: 1000,
    cohort: "spans_both",
    status: "normal",
    badges: ["GitHub Star"],
    signals: { hasBio: true, accountAgeDays: 1000 },
    score: { total: 88 },
    evaluations: [
      {
        rule: "accountAge",
        passed: true,
        nearMiss: false,
        reason: "PASS -- account is 1000d old (requires >= 30d)",
      },
    ],
    scoreInput: {} as ProcessResult["contributor"]["scoreInput"],
    prCount: 1,
    fetchedAt: "2024-03-15T00:00:00Z",
  },
  prs: [
    {
      prNumber: 7,
      repoFullName: "foo/bar",
      title: "Add feature",
      body: "details",
      state: "closed",
      createdAt: "2021-06-01T00:00:00Z",
      mergedAt: "2021-06-02T00:00:00Z",
      closedAt: "2021-06-02T00:00:00Z",
      timeToMergeMinutes: 60,
      additions: 10,
      deletions: 2,
      changedFiles: 3,
      commits: 1,
      selfClosed: false,
      labels: [],
      cohort: "pre_ai",
      ruleEvaluations: [
        {
          rule: "crypto",
          passed: true,
          nearMiss: false,
          reason: "PASS -- no crypto addresses found",
        },
      ],
    },
  ],
}

describe("iterJsonlContributors", () => {
  it("yields one valid JSON line per contributor with type='contributor'", () => {
    const lines = [...iterJsonlContributors([result])]
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0])
    expect(parsed.type).toBe("contributor")
    expect(parsed.username).toBe("grim")
    expect(parsed.cohort).toBe("spans_both")
    expect(parsed.signals.hasBio).toBe(true)
    expect(parsed.evaluations).toHaveLength(1)
    expect(parsed.evaluations[0].rule).toBe("accountAge")
    expect(parsed.badges).toEqual(["GitHub Star"])
  })

  it("omits the error key when no error is set", () => {
    const [line] = [...iterJsonlContributors([result])]
    expect(JSON.parse(line)).not.toHaveProperty("error")
  })

  it("includes the error key when an error is set", () => {
    const withError: ProcessResult = {
      ...result,
      contributor: { ...result.contributor, error: "rate limit" },
    }
    const [line] = [...iterJsonlContributors([withError])]
    expect(JSON.parse(line).error).toBe("rate limit")
  })
})

describe("iterJsonlPrs", () => {
  it("yields one line per PR with the contributor's username and ruleEvaluations", () => {
    const lines = [...iterJsonlPrs([result])]
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0])
    expect(parsed.type).toBe("pr")
    expect(parsed.username).toBe("grim")
    expect(parsed.prNumber).toBe(7)
    expect(parsed.cohort).toBe("pre_ai")
    expect(parsed.ruleEvaluations).toHaveLength(1)
    expect(parsed.ruleEvaluations[0].rule).toBe("crypto")
  })
})

describe("toJsonl", () => {
  it("emits contributors followed by PRs, terminated with a newline", () => {
    const jsonl = toJsonl([result])
    const lines = jsonl.trimEnd().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).type).toBe("contributor")
    expect(JSON.parse(lines[1]).type).toBe("pr")
    expect(jsonl.endsWith("\n")).toBe(true)
  })

  it("emits one JSON object per line (no pretty-printing)", () => {
    const jsonl = toJsonl([result])
    for (const line of jsonl.trimEnd().split("\n")) {
      expect(line.startsWith("{")).toBe(true)
      expect(line.endsWith("}")).toBe(true)
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })
})
