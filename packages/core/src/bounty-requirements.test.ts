import { describe, expect, it } from "vitest"
import {
  extractBountyRequirementCriteria,
  validateBountySubmissionRequirements,
} from "./bounty-requirements"

describe("bounty requirement validation", () => {
  it("extracts list criteria from requirement sections", () => {
    const body = `# Bounty

Intro paragraph.

## Acceptance Criteria

- Add a regression test for invalid submissions
- Reject submissions missing a deliverable URL
- Keep existing valid submissions accepted

## Notes

- This note is not a requirement
`

    expect(extractBountyRequirementCriteria(body)).toEqual([
      {
        id: "acceptance criteria-1",
        sourceHeading: "acceptance criteria",
        text: "Add a regression test for invalid submissions",
      },
      {
        id: "acceptance criteria-2",
        sourceHeading: "acceptance criteria",
        text: "Reject submissions missing a deliverable URL",
      },
      {
        id: "acceptance criteria-3",
        sourceHeading: "acceptance criteria",
        text: "Keep existing valid submissions accepted",
      },
    ])
  })

  it("passes a submission that covers every extracted criterion", () => {
    const result = validateBountySubmissionRequirements({
      bountyBody: `## Requirements
- Include tests for invalid submissions
- Require a deliverable URL before processing
`,
      submissionText:
        "This PR includes invalid submission tests and requires a deliverable URL before processing.",
    })

    expect(result.status).toBe("valid")
    expect(result.coverage).toBe(1)
    expect(result.missing).toEqual([])
  })

  it("reports missing criteria before a submission is processed", () => {
    const result = validateBountySubmissionRequirements({
      bountyBody: `## Requirements
- Include tests for invalid submissions
- Require a deliverable URL before processing
- Preserve existing approved submissions
`,
      submissionText:
        "This PR includes invalid submission tests and checks the deliverable URL.",
    })

    expect(result.status).toBe("missing_requirements")
    expect(result.requiredCount).toBe(3)
    expect(result.matched).toHaveLength(2)
    expect(result.missing).toEqual([
      {
        id: "requirements-3",
        sourceHeading: "requirements",
        text: "Preserve existing approved submissions",
      },
    ])
  })

  it("returns no_criteria when the bounty body has no requirement section", () => {
    const result = validateBountySubmissionRequirements({
      bountyBody: "Please improve this feature.",
      submissionText: "Done.",
    })

    expect(result.status).toBe("no_criteria")
    expect(result.coverage).toBe(1)
    expect(result.requiredCount).toBe(0)
  })
})
