import { and, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { adminProcedure } from "../init"
import { db } from "@tripwire/db/client"
import {
  events as eventsTable,
  githubReputation,
  organizations,
  repositories,
  user as userTable,
  visibilitySyncRuns,
} from "@tripwire/db"

import type { TRPCRouterRecord } from "@trpc/server"

export const adminOverviewRouter = {
  overview: adminProcedure.query(async () => {
    const since24h = new Date()
    since24h.setHours(since24h.getHours() - 24)
    const since7d = new Date()
    since7d.setDate(since7d.getDate() - 7)

    const [
      userCountRow,
      orgCountRow,
      repoCountRow,
      reputationCountRow,
      blocks24hRow,
      nearMisses24hRow,
      allows24hRow,
      events7dRow,
      activeSyncs,
      lowestScoreRow,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(userTable),
      db.select({ count: sql<number>`count(*)::int` }).from(organizations),
      db.select({ count: sql<number>`count(*)::int` }).from(repositories),
      db.select({ count: sql<number>`count(*)::int` }).from(githubReputation),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventsTable)
        .where(
          and(
            eq(eventsTable.action, "pipeline_blocked"),
            gte(eventsTable.createdAt, since24h)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventsTable)
        .where(
          and(
            eq(eventsTable.action, "rule_near_miss"),
            gte(eventsTable.createdAt, since24h)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventsTable)
        .where(
          and(
            eq(eventsTable.action, "pipeline_allowed"),
            gte(eventsTable.createdAt, since24h)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventsTable)
        .where(gte(eventsTable.createdAt, since7d)),
      db
        .select({
          id: visibilitySyncRuns.id,
          repoFullName: repositories.fullName,
          status: visibilitySyncRuns.status,
          startedAt: visibilitySyncRuns.startedAt,
        })
        .from(visibilitySyncRuns)
        .innerJoin(repositories, eq(repositories.id, visibilitySyncRuns.repoId))
        .where(inArray(visibilitySyncRuns.status, ["queued", "running"]))
        .orderBy(desc(visibilitySyncRuns.createdAt))
        .limit(5),
      db
        .select({
          githubUsername: githubReputation.githubUsername,
          githubUserId: githubReputation.githubUserId,
          score: githubReputation.score,
          totalBlocks: githubReputation.totalBlocks,
          totalAllows: githubReputation.totalAllows,
          repoFullName: repositories.fullName,
          lastSeenAt: githubReputation.lastSeenAt,
        })
        .from(githubReputation)
        .leftJoin(repositories, eq(repositories.id, githubReputation.repoId))
        .where(
          and(
            gte(githubReputation.totalBlocks, 1),
            gte(githubReputation.lastSeenAt, since7d)
          )
        )
        .orderBy(githubReputation.score, desc(githubReputation.totalBlocks))
        .limit(10),
    ])

    return {
      users: userCountRow[0]?.count ?? 0,
      orgs: orgCountRow[0]?.count ?? 0,
      repos: repoCountRow[0]?.count ?? 0,
      contributors: reputationCountRow[0]?.count ?? 0,
      blocks24h: blocks24hRow[0]?.count ?? 0,
      nearMisses24h: nearMisses24hRow[0]?.count ?? 0,
      allows24h: allows24hRow[0]?.count ?? 0,
      events7d: events7dRow[0]?.count ?? 0,
      activeSyncs,
      lowScoreContributors: lowestScoreRow,
    }
  }),

  recentBlocks: adminProcedure.query(async () => {
    const since7d = new Date()
    since7d.setDate(since7d.getDate() - 7)

    return db
      .select({
        id: eventsTable.id,
        action: eventsTable.action,
        severity: eventsTable.severity,
        description: eventsTable.description,
        targetGithubUsername: eventsTable.targetGithubUsername,
        targetGithubUserId: eventsTable.targetGithubUserId,
        githubRef: eventsTable.githubRef,
        ruleName: eventsTable.ruleName,
        createdAt: eventsTable.createdAt,
        repoFullName: repositories.fullName,
      })
      .from(eventsTable)
      .leftJoin(repositories, eq(repositories.id, eventsTable.repoId))
      .where(
        and(
          inArray(eventsTable.action, [
            "pipeline_blocked",
            "blacklist_blocked",
            "rule_near_miss",
          ]),
          gte(eventsTable.createdAt, since7d)
        )
      )
      .orderBy(desc(eventsTable.createdAt))
      .limit(25)
  }),
} satisfies TRPCRouterRecord
