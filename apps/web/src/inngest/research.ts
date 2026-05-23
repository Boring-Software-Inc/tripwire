import { and, eq } from "drizzle-orm"
import { db } from "@tripwire/db/client"
import { researchContributors, researchPrs, researchRuns } from "@tripwire/db"
import { env } from "@tripwire/env/server"
import {
  githubBucket,
  processContributor,
  withBucket,
} from "@tripwire/research"
import { inngest } from "./client"

const BATCH_SIZE = 10

export const processResearchRun = inngest.createFunction(
  {
    id: "process-research-run",
    concurrency: { limit: 2 },
    retries: 2,
    triggers: [{ event: "research/run.requested" }],
  },
  async ({ event, step }) => {
    const { runId } = event.data

    const run = await step.run("load-run", async () => {
      const [row] = await db
        .select()
        .from(researchRuns)
        .where(eq(researchRuns.id, runId))
        .limit(1)
      if (!row) throw new Error(`research run ${runId} not found`)
      return row
    })

    const token = env.RESEARCH_GH_TOKEN
    if (!token) {
      await db
        .update(researchRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage:
            "RESEARCH_GH_TOKEN not set — research runs need a PAT with public_repo scope",
        })
        .where(eq(researchRuns.id, runId))
      throw new Error("RESEARCH_GH_TOKEN env var not configured")
    }

    await step.run("mark-running", async () => {
      await db
        .update(researchRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(researchRuns.id, runId))
    })

    const params = run.params
    const usernames = params.usernames
    const cutoffDate = params.cutoffDate
    const prLimit = params.prLimitPerUser ?? 100
    const bucket = githubBucket()

    let completed = 0
    let errored = 0
    let totalPrs = 0

    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      const chunk = usernames.slice(i, i + BATCH_SIZE)
      const batchIndex = Math.floor(i / BATCH_SIZE)

      const batchResult = await step.run(
        `batch-${batchIndex}`,
        async (): Promise<{
          completed: number
          errored: number
          prs: number
        }> => {
          let chunkCompleted = 0
          let chunkErrored = 0
          let chunkPrs = 0

          await Promise.all(
            chunk.map(async (username) => {
              try {
                const { contributor, prs } = await withBucket(bucket, () =>
                  processContributor(username, token, {
                    cutoffDate,
                    prLimit,
                  })
                )

                const [inserted] = await db
                  .insert(researchContributors)
                  .values({
                    runId,
                    username: contributor.username,
                    accountCreatedAt: contributor.accountCreatedAt
                      ? new Date(contributor.accountCreatedAt)
                      : null,
                    accountAgeDays: contributor.accountAgeDays,
                    cohort: contributor.cohort,
                    signals: contributor.signals,
                    score: contributor.score,
                    evaluations: contributor.evaluations,
                    prCount: contributor.prCount,
                    fetchedAt: new Date(contributor.fetchedAt),
                    error: contributor.error ?? null,
                  })
                  .returning({ id: researchContributors.id })

                if (inserted && prs.length > 0) {
                  await db.insert(researchPrs).values(
                    prs.map((pr) => ({
                      contributorId: inserted.id,
                      prNumber: pr.prNumber,
                      repoFullName: pr.repoFullName,
                      title: pr.title,
                      body: pr.body,
                      state: pr.state,
                      createdAt: new Date(pr.createdAt),
                      mergedAt: pr.mergedAt ? new Date(pr.mergedAt) : null,
                      closedAt: pr.closedAt ? new Date(pr.closedAt) : null,
                      timeToMergeMinutes: pr.timeToMergeMinutes,
                      additions: pr.additions,
                      deletions: pr.deletions,
                      changedFiles: pr.changedFiles,
                      commits: pr.commits,
                      selfClosed: pr.selfClosed,
                      labels: pr.labels,
                      cohort: pr.cohort,
                      ruleEvaluations: pr.ruleEvaluations,
                    }))
                  )
                }

                chunkCompleted += 1
                chunkPrs += prs.length
              } catch (err) {
                chunkErrored += 1
                await db
                  .insert(researchContributors)
                  .values({
                    runId,
                    username,
                    accountCreatedAt: null,
                    accountAgeDays: 0,
                    cohort: "post_ai_only",
                    signals: {},
                    score: {},
                    evaluations: [],
                    prCount: 0,
                    fetchedAt: new Date(),
                    error: err instanceof Error ? err.message : String(err),
                  })
                  .onConflictDoNothing()
              }
            })
          )

          return {
            completed: chunkCompleted,
            errored: chunkErrored,
            prs: chunkPrs,
          }
        }
      )

      completed += batchResult.completed
      errored += batchResult.errored
      totalPrs += batchResult.prs

      await step.run(`update-stats-${batchIndex}`, async () => {
        await db
          .update(researchRuns)
          .set({
            stats: {
              requested: usernames.length,
              completed,
              errored,
              prs: totalPrs,
            },
          })
          .where(
            and(eq(researchRuns.id, runId), eq(researchRuns.status, "running"))
          )
      })
    }

    await step.run("mark-complete", async () => {
      await db
        .update(researchRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          stats: {
            requested: usernames.length,
            completed,
            errored,
            prs: totalPrs,
          },
        })
        .where(eq(researchRuns.id, runId))
    })

    return { runId, completed, errored, prs: totalPrs }
  }
)
