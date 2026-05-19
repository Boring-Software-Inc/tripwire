import { artifact } from "@ai-sdk-tools/artifacts"
import { z } from "zod"

export const ContributorAnalysis = artifact(
  "contributor-analysis",
  z.object({
    username: z.string(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]),
    score: z.number().min(0).max(100),
    factors: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        impact: z.enum(["positive", "neutral", "negative"]),
      })
    ),
    recommendation: z.string(),
  })
)

export const RuleImpactReport = artifact(
  "rule-impact-report",
  z.object({
    ruleName: z.string(),
    enabled: z.boolean(),
    triggeredCount: z.number(),
    affectedUsers: z.number(),
    timeRange: z.string(),
    breakdown: z.array(z.object({ action: z.string(), count: z.number() })),
  })
)

export const EventTimeline = artifact(
  "event-timeline",
  z.object({
    repoName: z.string(),
    events: z.array(
      z.object({
        id: z.string(),
        action: z.string(),
        username: z.string(),
        severity: z.string(),
        timestamp: z.string(),
      })
    ),
    totalCount: z.number(),
  })
)
