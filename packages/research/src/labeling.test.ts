import { describe, it, expect } from "vitest"
import { cohortForPr, cohortFromPrs, DEFAULT_CUTOFF_DATE } from "./labeling"

describe("cohortForPr", () => {
  it("labels PRs created before the cutoff as pre_ai", () => {
    expect(cohortForPr("2021-06-15T00:00:00Z", DEFAULT_CUTOFF_DATE)).toBe(
      "pre_ai"
    )
  })

  it("labels PRs created after the cutoff as post_ai", () => {
    expect(cohortForPr("2024-01-01T00:00:00Z", DEFAULT_CUTOFF_DATE)).toBe(
      "post_ai"
    )
  })

  it("labels PRs on the exact cutoff as post_ai (>= cutoff is post)", () => {
    expect(cohortForPr(DEFAULT_CUTOFF_DATE, DEFAULT_CUTOFF_DATE)).toBe(
      "post_ai"
    )
  })

  it("accepts Date instances as well as strings", () => {
    expect(
      cohortForPr(new Date("2021-01-01"), new Date(DEFAULT_CUTOFF_DATE))
    ).toBe("pre_ai")
  })

  it("respects a custom cutoff", () => {
    expect(cohortForPr("2020-05-01T00:00:00Z", "2020-01-01T00:00:00Z")).toBe(
      "post_ai"
    )
  })
})

describe("cohortFromPrs", () => {
  it("returns post_ai_only for contributors with no PRs", () => {
    expect(cohortFromPrs([])).toBe("post_ai_only")
  })

  it("returns pre_ai_only when every PR is pre_ai", () => {
    expect(cohortFromPrs([{ cohort: "pre_ai" }, { cohort: "pre_ai" }])).toBe(
      "pre_ai_only"
    )
  })

  it("returns post_ai_only when every PR is post_ai", () => {
    expect(cohortFromPrs([{ cohort: "post_ai" }])).toBe("post_ai_only")
  })

  it("returns spans_both when the contributor straddles the cutoff", () => {
    expect(
      cohortFromPrs([
        { cohort: "pre_ai" },
        { cohort: "post_ai" },
        { cohort: "post_ai" },
      ])
    ).toBe("spans_both")
  })
})
