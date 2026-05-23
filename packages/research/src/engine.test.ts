import { describe, it, expect, vi } from "vitest"

// The engine drives real GH/DB calls. We mock the IO boundary
// (fetchContributorSignals + fetchUserPRs) and assert that the engine routes
// through the REAL block evaluators in @tripwire/core/blocks.

vi.mock("@tripwire/core/contributor-fetch", () => ({
  fetchContributorSignals: vi.fn(),
}))
vi.mock("@tripwire/github/data-factory", () => ({
  fetchUserPRs: vi.fn(),
}))

import { processContributor } from "./engine"
import { DEFAULT_CUTOFF_DATE } from "./labeling"
import { fetchContributorSignals } from "@tripwire/core/contributor-fetch"
import { fetchUserPRs } from "@tripwire/github/data-factory"

const baseGhUser = {
  login: "test-user",
  id: 1,
  created_at: "2020-01-01T00:00:00Z",
  bio: "engineer",
  company: "@acme",
  blog: "https://example.com",
  twitter_username: "test",
  two_factor_authentication: true,
  public_repos: 12,
  public_gists: 0,
  followers: 50,
  following: 30,
}

const baseSignals = {
  ghUser: baseGhUser,
  status: "normal" as const,
  badges: [],
  scoreInput: {
    accountAgeDays: 1500,
    followers: 50,
    following: 30,
    publicRepos: 12,
    publicNonForkRepoCount: 8,
    publicForkRepoCount: 2,
    contextRepoPrCount: 0,
    publicGists: 0,
    bio: "engineer",
    company: "@acme",
    location: null,
    blog: "https://example.com",
    twitterUsername: "test",
    hasTwoFactor: true,
    hasProfileReadme: true,
    graphql: null,
    achievements: [],
    mergedPrCount: 50,
    closedPrCount: 60,
    closedUnmergedPrCount: 10,
    blockedCount: 0,
    allowedCount: 5,
    nearMissCount: 0,
    mergedPrSummary: null,
    prTemporalData: null,
    repoEvents: null,
  },
}

const mockFetchSignals = fetchContributorSignals as ReturnType<typeof vi.fn>
const mockFetchPRs = fetchUserPRs as ReturnType<typeof vi.fn>

describe("processContributor", () => {
  it("dispatches contributor signals to real rule blocks and returns RuleEvaluation[]", async () => {
    mockFetchSignals.mockResolvedValueOnce(baseSignals)
    mockFetchPRs.mockResolvedValueOnce({ items: [], totalCount: 0 })

    const result = await processContributor("test-user", "TOKEN", {
      cutoffDate: DEFAULT_CUTOFF_DATE,
    })

    expect(result.contributor.username).toBe("test-user")
    // resolveAllSignals derives accountAgeDays from ghUser.created_at, not scoreInput
    expect(result.contributor.signals.accountAgeDays).toBeGreaterThan(1000)
    expect(result.contributor.signals.mergedPrs).toBe(0)
    const ruleNames = result.contributor.evaluations.map((e) => e.rule)
    expect(ruleNames).toContain("accountAge")
    expect(ruleNames).toContain("minMergedPrs")
    expect(ruleNames).toContain("requireProfileReadme")
    expect(ruleNames).toContain("repoActivityMinimum")
    expect(ruleNames).toContain("vouchedUsersOnly")
    expect(ruleNames).toContain("contributorScore")
  })

  it("accountAge rule fires PASS for old account, FAIL for young", async () => {
    mockFetchSignals.mockResolvedValueOnce(baseSignals)
    mockFetchPRs.mockResolvedValueOnce({ items: [], totalCount: 0 })
    const res = await processContributor("u", "TOKEN", {
      cutoffDate: DEFAULT_CUTOFF_DATE,
    })
    const ev = res.contributor.evaluations.find((e) => e.rule === "accountAge")
    expect(ev?.passed).toBe(true)
    expect(ev?.reason).toMatch(/PASS -- account is \d+d old/)

    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString()
    mockFetchSignals.mockResolvedValueOnce({
      ...baseSignals,
      ghUser: { ...baseSignals.ghUser, created_at: recent },
    })
    mockFetchPRs.mockResolvedValueOnce({ items: [], totalCount: 0 })
    const res2 = await processContributor("u", "TOKEN", {
      cutoffDate: DEFAULT_CUTOFF_DATE,
    })
    const ev2 = res2.contributor.evaluations.find(
      (e) => e.rule === "accountAge"
    )
    expect(ev2?.passed).toBe(false)
    expect(ev2?.reason).toContain("5d old")
  })

  it("per-PR ruleEvaluations include crypto/language/aiHoneypot with the real Tripwire detail strings", async () => {
    mockFetchSignals.mockResolvedValueOnce(baseSignals)
    mockFetchPRs.mockResolvedValueOnce({
      items: [
        {
          number: 1,
          title: "Add feature",
          body: "Just a normal PR body",
          state: "closed",
          createdAt: "2024-01-15T12:00:00Z",
          closedAt: "2024-01-15T13:00:00Z",
          mergedAt: "2024-01-15T13:00:00Z",
          repoFullName: "example/repo",
          labels: [],
          authorLogin: "u",
          authorAvatar: "",
          additions: 10,
          deletions: 2,
          changedFiles: 3,
          commits: 1,
          timeToMergeMinutes: 60,
          draft: false,
          headSha: null,
          closedBy: null,
          selfClosed: false,
        },
      ],
      totalCount: 1,
    })

    const result = await processContributor("u", "TOKEN", {
      cutoffDate: DEFAULT_CUTOFF_DATE,
    })

    expect(result.prs).toHaveLength(1)
    const pr = result.prs[0]
    const rules = pr.ruleEvaluations.map((e) => e.rule)
    expect(rules).toEqual(["crypto", "language", "aiHoneypot"])
    expect(pr.ruleEvaluations.find((e) => e.rule === "crypto")?.passed).toBe(
      true
    )
    expect(
      pr.ruleEvaluations.find((e) => e.rule === "language")?.reason
    ).toContain("language: en")
  })

  it("crypto rule FAILs when a PR body contains a wallet address", async () => {
    mockFetchSignals.mockResolvedValueOnce(baseSignals)
    mockFetchPRs.mockResolvedValueOnce({
      items: [
        {
          number: 2,
          title: "Donate",
          body: "Send 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7 please",
          state: "open",
          createdAt: "2024-01-15T12:00:00Z",
          closedAt: null,
          mergedAt: null,
          repoFullName: "example/repo",
          labels: [],
          authorLogin: "u",
          authorAvatar: "",
          additions: 1,
          deletions: 0,
          changedFiles: 1,
          commits: 1,
          timeToMergeMinutes: null,
          draft: false,
          headSha: null,
          closedBy: null,
          selfClosed: null,
        },
      ],
      totalCount: 1,
    })

    const result = await processContributor("u", "TOKEN", {
      cutoffDate: DEFAULT_CUTOFF_DATE,
    })
    const cryptoEval = result.prs[0].ruleEvaluations.find(
      (e) => e.rule === "crypto"
    )
    expect(cryptoEval?.passed).toBe(false)
    expect(cryptoEval?.reason).toContain("crypto address detected")
  })

  it("cohort labels PRs by createdAt vs cutoff", async () => {
    mockFetchSignals.mockResolvedValueOnce(baseSignals)
    mockFetchPRs.mockResolvedValueOnce({
      items: [
        {
          number: 1,
          title: "Pre",
          body: "",
          state: "closed",
          createdAt: "2021-06-15T00:00:00Z",
          closedAt: null,
          mergedAt: "2021-06-16T00:00:00Z",
          repoFullName: "x/y",
          labels: [],
          authorLogin: "u",
          authorAvatar: "",
          additions: 0,
          deletions: 0,
          changedFiles: 0,
          commits: 0,
          timeToMergeMinutes: null,
          draft: false,
          headSha: null,
          closedBy: null,
          selfClosed: null,
        },
        {
          number: 2,
          title: "Post",
          body: "",
          state: "closed",
          createdAt: "2024-03-01T00:00:00Z",
          closedAt: null,
          mergedAt: "2024-03-02T00:00:00Z",
          repoFullName: "x/y",
          labels: [],
          authorLogin: "u",
          authorAvatar: "",
          additions: 0,
          deletions: 0,
          changedFiles: 0,
          commits: 0,
          timeToMergeMinutes: null,
          draft: false,
          headSha: null,
          closedBy: null,
          selfClosed: null,
        },
      ],
      totalCount: 2,
    })

    const result = await processContributor("u", "TOKEN", {
      cutoffDate: DEFAULT_CUTOFF_DATE,
    })
    expect(result.prs[0].cohort).toBe("pre_ai")
    expect(result.prs[1].cohort).toBe("post_ai")
    expect(result.contributor.cohort).toBe("spans_both")
  })
})
