import { and, eq, sql } from "drizzle-orm"
import { createError } from "evlog"
import { db } from "@tripwire/db/client"
import {
  events,
  githubReputation,
  organizations,
  repositories,
  visibilitySyncRuns,
} from "@tripwire/db"
import {
  getInstallationToken,
  listAllIssues,
  listAllPullRequests,
} from "@tripwire/github"
import { inngest } from "./client"
import {
  buildBackfillEventRows,
  recomputeRichScores,
} from "./visibility-helpers"

const EVENT_INSERT_CHUNK = 200

export const syncRepoHistory = inngest.createFunction(
  {
    id: "sync-repo-history",
    concurrency: { limit: 2 },
    retries: 1,
    triggers: [{ event: "visibility/sync.requested" }],
  },
  async ({ event, step }) => {
    const { runId } = event.data as { runId: string }

    const loaded = await step.run("load-run", async () => {
      const [row] = await db
        .select({
          repoId: repositories.id,
          repoFullName: repositories.fullName,
          installationId: organizations.githubInstallationId,
        })
        .from(visibilitySyncRuns)
        .innerJoin(repositories, eq(repositories.id, visibilitySyncRuns.repoId))
        .innerJoin(organizations, eq(organizations.id, repositories.orgId))
        .where(eq(visibilitySyncRuns.id, runId))
        .limit(1)
      if (!row) {
        throw createError({
          code: "visibility.sync_run_not_found",
          status: 404,
          message: `visibility sync run ${runId} not found`,
          internal: { runId },
        })
      }
      return row
    })

    try {
      await step.run("mark-running", async () => {
        await db
          .update(visibilitySyncRuns)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(visibilitySyncRuns.id, runId))
      })

      const token = await step.run("get-token", () =>
        getInstallationToken(loaded.installationId)
      )

      const [owner, repoName] = loaded.repoFullName.split("/")
      if (!owner || !repoName) {
        throw createError({
          code: "visibility.repo_fullname_invalid",
          status: 500,
          message: `invalid repo fullName: ${loaded.repoFullName}`,
          internal: { fullName: loaded.repoFullName },
        })
      }

      const prs = await step.run("page-prs", () =>
        listAllPullRequests(token, owner, repoName)
      )
      const issues = await step.run("page-issues", () =>
        listAllIssues(token, owner, repoName)
      )

      const inserted = await step.run("insert-events", async () => {
        const existing = await db
          .select({ githubRef: events.githubRef })
          .from(events)
          .where(
            and(
              eq(events.repoId, loaded.repoId),
              sql`${events.metadata}->>'source' = 'history_backfill'`
            )
          )
        const existingRefs = new Set(
          existing.map((e) => e.githubRef).filter((r): r is string => !!r)
        )

        const built = buildBackfillEventRows(
          loaded.repoId,
          runId,
          prs,
          issues
        ).filter((b) => !existingRefs.has(b.row.githubRef!))

        let count = 0
        for (let i = 0; i < built.length; i += EVENT_INSERT_CHUNK) {
          const chunk = built.slice(i, i + EVENT_INSERT_CHUNK)
          await db.insert(events).values(chunk.map((b) => b.row))
          count += chunk.length
        }

        const contributors = new Set(built.map((b) => b.username.toLowerCase()))
        return { eventsInserted: count, contributors: contributors.size }
      })

      // one-shot cleanup of bot/ghost rows that leaked in before the
      // logEvent-level filter existed
      await step.run("purge-bots", async () => {
        await db.delete(githubReputation).where(
          and(
            eq(githubReputation.repoId, loaded.repoId),
            sql`(
                lower(${githubReputation.githubUsername}) = 'ghost'
                or lower(${githubReputation.githubUsername}) like '%[bot]'
                or lower(${githubReputation.githubUsername}) like '%bot'
              )`
          )
        )
      })

      await step.run("update-reputation", async () => {
        await db.execute(sql`
          insert into github_reputation (
            repo_id, github_username, github_user_id,
            total_allows, total_blocks, total_near_misses,
            first_seen_at, last_seen_at
          )
          select
            ${loaded.repoId}::uuid,
            max(target_github_username),
            max(target_github_user_id),
            count(*) filter (where action = 'pipeline_allowed')::int,
            count(*) filter (where action in ('pipeline_blocked', 'blacklist_blocked'))::int,
            count(*) filter (where action = 'rule_near_miss')::int,
            min(created_at),
            max(created_at)
          from events
          where repo_id = ${loaded.repoId}::uuid
            and target_github_username is not null
          group by lower(target_github_username)
          on conflict (repo_id, (lower(github_username))) do update set
            github_user_id = coalesce(github_reputation.github_user_id, excluded.github_user_id),
            github_username = excluded.github_username,
            total_allows = excluded.total_allows,
            total_blocks = excluded.total_blocks,
            total_near_misses = excluded.total_near_misses,
            first_seen_at = least(github_reputation.first_seen_at, excluded.first_seen_at),
            last_seen_at = greatest(github_reputation.last_seen_at, excluded.last_seen_at),
            updated_at = now()
        `)
      })

      const scoreStats = await step.run("compute-rich-scores", () =>
        recomputeRichScores(loaded.repoId, token)
      )

      await step.run("mark-complete", async () => {
        await db
          .update(visibilitySyncRuns)
          .set({
            status: "completed",
            completedAt: new Date(),
            stats: {
              prs: prs.length,
              issues: issues.length,
              contributors: inserted.contributors,
              eventsInserted: inserted.eventsInserted,
              scored: scoreStats.scored,
              scoreSkipped: scoreStats.skipped,
            },
          })
          .where(eq(visibilitySyncRuns.id, runId))
      })

      return {
        runId,
        ...inserted,
        prs: prs.length,
        issues: issues.length,
        scored: scoreStats.scored,
        scoreSkipped: scoreStats.skipped,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await db
        .update(visibilitySyncRuns)
        .set({
          status: "errored",
          completedAt: new Date(),
          errorMessage: message,
        })
        .where(eq(visibilitySyncRuns.id, runId))
      throw err
    }
  }
)
