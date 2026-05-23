import { z } from "zod"
import { and, desc, eq } from "drizzle-orm"
import { adminProcedure } from "../init"
import { trpcError } from "../error"
import { db } from "@tripwire/db/client"
import {
  researchContributors,
  researchPrs,
  researchRuns,
  type ContributorCohort,
  type PrCohort,
  type ResearchRuleEvaluation,
} from "@tripwire/db"
import {
  contributorsToCsv,
  prsToCsv,
  toJsonl,
  type ProcessResult,
} from "@tripwire/research"
import type { ScoreInput } from "@tripwire/core"
import { inngest } from "#/inngest/client"
import type { TRPCRouterRecord } from "@trpc/server"

const usernameSchema = z
  .string()
  .min(1)
  .max(39)
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/)

export const researchRouter = {
  kickoff: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        usernames: z.array(usernameSchema).min(1).max(5000),
        cutoffDate: z.string().datetime().optional(),
        prLimitPerUser: z.number().int().min(1).max(500).optional(),
        repoFullName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cutoffDate = input.cutoffDate ?? "2022-11-30T00:00:00.000Z"
      const usernames = Array.from(new Set(input.usernames))

      const [run] = await db
        .insert(researchRuns)
        .values({
          name: input.name,
          status: "queued",
          params: {
            cutoffDate,
            repoFullName: input.repoFullName,
            usernames,
            prLimitPerUser: input.prLimitPerUser,
          },
          stats: {
            requested: usernames.length,
            completed: 0,
            errored: 0,
            prs: 0,
          },
          createdByUserId: ctx.user.id,
        })
        .returning({ id: researchRuns.id })

      if (!run)
        throw trpcError({
          message: "failed to create research run",
          trpcCode: "INTERNAL_SERVER_ERROR",
        })

      await inngest.send({
        name: "research/run.requested",
        data: { runId: run.id },
      })

      return { runId: run.id, requested: usernames.length }
    }),

  list: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50
      const rows = await db
        .select()
        .from(researchRuns)
        .orderBy(desc(researchRuns.createdAt))
        .limit(limit)
      return rows
    }),

  status: adminProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [run] = await db
        .select()
        .from(researchRuns)
        .where(eq(researchRuns.id, input.runId))
        .limit(1)
      if (!run)
        throw trpcError({
          message: "research run not found",
          trpcCode: "NOT_FOUND",
        })
      return run
    }),

  contributors: adminProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(100),
        cohort: z
          .enum(["pre_ai_only", "post_ai_only", "spans_both"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const conditions = [eq(researchContributors.runId, input.runId)]
      if (input.cohort) {
        conditions.push(eq(researchContributors.cohort, input.cohort))
      }
      const rows = await db
        .select()
        .from(researchContributors)
        .where(and(...conditions))
        .limit(input.limit)
      return rows
    }),

  exportCsv: adminProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        scope: z.enum(["contributors", "prs"]),
      })
    )
    .query(async ({ input }) => {
      const results = await loadResults(input.runId)
      const csv =
        input.scope === "contributors"
          ? contributorsToCsv(results)
          : prsToCsv(results)
      return { filename: `${input.runId}-${input.scope}.csv`, body: csv }
    }),

  exportJsonl: adminProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      const results = await loadResults(input.runId)
      return {
        filename: `${input.runId}.jsonl`,
        body: toJsonl(results),
      }
    }),
} satisfies TRPCRouterRecord

async function loadResults(runId: string): Promise<ProcessResult[]> {
  const contributors = await db
    .select()
    .from(researchContributors)
    .where(eq(researchContributors.runId, runId))

  if (contributors.length === 0) return []

  const prRows = await db
    .select()
    .from(researchPrs)
    .where(and(...contributors.map((c) => eq(researchPrs.contributorId, c.id))))

  const prsByContributor = new Map<string, typeof prRows>()
  for (const pr of prRows) {
    const list = prsByContributor.get(pr.contributorId) ?? []
    list.push(pr)
    prsByContributor.set(pr.contributorId, list)
  }

  return contributors.map((c) => ({
    contributor: {
      username: c.username,
      ghUser: null,
      accountCreatedAt: c.accountCreatedAt?.toISOString() ?? null,
      accountAgeDays: c.accountAgeDays ?? 0,
      cohort: (c.cohort ?? "post_ai_only") as ContributorCohort,
      status: "normal" as const,
      badges: [],
      signals: c.signals,
      score: c.score,
      evaluations: c.evaluations as ResearchRuleEvaluation[],
      scoreInput: {} as ScoreInput,
      prCount: c.prCount,
      fetchedAt: c.fetchedAt.toISOString(),
      error: c.error ?? undefined,
    },
    prs: (prsByContributor.get(c.id) ?? []).map((pr) => ({
      prNumber: pr.prNumber,
      repoFullName: pr.repoFullName,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      createdAt: pr.createdAt.toISOString(),
      mergedAt: pr.mergedAt?.toISOString() ?? null,
      closedAt: pr.closedAt?.toISOString() ?? null,
      timeToMergeMinutes: pr.timeToMergeMinutes,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changedFiles ?? 0,
      commits: pr.commits ?? 0,
      selfClosed: pr.selfClosed,
      labels: pr.labels,
      cohort: pr.cohort as PrCohort,
      ruleEvaluations: pr.ruleEvaluations as ResearchRuleEvaluation[],
    })),
  }))
}
