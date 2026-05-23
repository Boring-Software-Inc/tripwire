import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export type ResearchRunStatus = "queued" | "running" | "completed" | "failed"
export type ContributorCohort = "pre_ai_only" | "post_ai_only" | "spans_both"
export type PrCohort = "pre_ai" | "post_ai"

/** Subset of @tripwire/core's RuleEvaluation that research actually populates from `block.evaluate`. */
export interface ResearchRuleEvaluation {
  rule: string
  passed: boolean
  nearMiss: boolean
  reason?: string
  actual?: number
  threshold?: number
}

export interface ResearchRunParams {
  cutoffDate: string
  repoFullName?: string
  usernames: string[]
  prLimitPerUser?: number
}

export interface ResearchRunStats {
  requested: number
  completed: number
  errored: number
  prs: number
}

export const researchRuns = pgTable("research_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").$type<ResearchRunStatus>().notNull().default("queued"),
  params: jsonb("params").$type<ResearchRunParams>().notNull(),
  stats: jsonb("stats").$type<ResearchRunStats>().notNull().default({
    requested: 0,
    completed: 0,
    errored: 0,
    prs: 0,
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdByUserId: text("created_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  errorMessage: text("error_message"),
})

export const researchContributors = pgTable(
  "research_contributors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    accountCreatedAt: timestamp("account_created_at"),
    accountAgeDays: integer("account_age_days"),
    cohort: text("cohort").$type<ContributorCohort>(),
    signals: jsonb("signals").$type<Record<string, unknown>>().notNull(),
    score: jsonb("score").$type<Record<string, unknown>>().notNull(),
    evaluations: jsonb("evaluations")
      .$type<ResearchRuleEvaluation[]>()
      .notNull()
      .default([]),
    prCount: integer("pr_count").notNull().default(0),
    fetchedAt: timestamp("fetched_at").notNull(),
    error: text("error"),
  },
  (t) => [
    uniqueIndex("research_contrib_unique").on(t.runId, t.username),
    index("research_contrib_run_idx").on(t.runId),
    index("research_contrib_cohort_idx").on(t.cohort),
  ]
)

export const researchPrs = pgTable(
  "research_prs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => researchContributors.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    repoFullName: text("repo_full_name").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull(),
    createdAt: timestamp("created_at").notNull(),
    mergedAt: timestamp("merged_at"),
    closedAt: timestamp("closed_at"),
    timeToMergeMinutes: integer("time_to_merge_minutes"),
    additions: integer("additions"),
    deletions: integer("deletions"),
    changedFiles: integer("changed_files"),
    commits: integer("commits"),
    selfClosed: boolean("self_closed"),
    labels: jsonb("labels")
      .$type<Array<{ name: string; color: string }>>()
      .notNull()
      .default([]),
    cohort: text("cohort").$type<PrCohort>().notNull(),
    /** Per-PR rule evaluations from running content blocks (crypto, language, aiHoneypot) against the PR body. */
    ruleEvaluations: jsonb("rule_evaluations")
      .$type<ResearchRuleEvaluation[]>()
      .notNull()
      .default([]),
  },
  (t) => [
    index("research_prs_contrib_idx").on(t.contributorId),
    index("research_prs_cohort_idx").on(t.cohort),
  ]
)

export type ResearchRun = typeof researchRuns.$inferSelect
export type NewResearchRun = typeof researchRuns.$inferInsert
export type ResearchContributor = typeof researchContributors.$inferSelect
export type NewResearchContributor = typeof researchContributors.$inferInsert
export type ResearchPr = typeof researchPrs.$inferSelect
export type NewResearchPr = typeof researchPrs.$inferInsert
