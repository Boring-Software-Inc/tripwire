import { z } from "zod"
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { adminProcedure } from "../init"
import { trpcError } from "../error"
import { db } from "@tripwire/db/client"
import { user as userTable, ACCESS_STATUSES } from "@tripwire/db"
import { fetchPublicUser } from "@tripwire/github"
import { inngest } from "#/inngest/client"

import type { TRPCRouterRecord } from "@trpc/server"

const statusEnum = z.enum(ACCESS_STATUSES)

export const accessRequestsRouter = {
  /**
   * Paginated access-request list for the admin queue. Defaults to pending,
   * ordered so the oldest waiting requests surface first (waitlist claimants
   * ahead of fresh signups). Search matches name/email — the GitHub login
   * isn't stored on the user row, so per-row username lookups go through
   * `githubMeta` instead.
   */
  list: adminProcedure
    .input(
      z.object({
        status: statusEnum.default("pending"),
        search: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const filters = [eq(userTable.accessStatus, input.status)]
      if (input.search) {
        const term = `%${input.search}%`
        const match = or(
          ilike(userTable.name, term),
          ilike(userTable.email, term)
        )
        if (match) filters.push(match)
      }
      const where = and(...filters)

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(userTable)
        .where(where)

      const rows = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          image: userTable.image,
          githubId: userTable.githubId,
          accessStatus: userTable.accessStatus,
          accessReviewedAt: userTable.accessReviewedAt,
          waitlistedAt: userTable.waitlistedAt,
          createdAt: userTable.createdAt,
        })
        .from(userTable)
        .where(where)
        // Waitlist claimants first (oldest join date), then oldest signups.
        .orderBy(
          sql`${userTable.waitlistedAt} asc nulls last`,
          asc(userTable.createdAt)
        )
        .limit(input.limit)
        .offset(input.offset)

      return { items: rows, total, limit: input.limit, offset: input.offset }
    }),

  /**
   * Lazily-loaded GitHub metadata for one request row: login, avatar, and
   * account age. Uses the unauthenticated public API keyed on the numeric
   * GitHub id, so the queue list renders without blocking on 60/hr-limited
   * calls. Returns null when the id is missing or the lookup fails.
   */
  githubMeta: adminProcedure
    .input(z.object({ githubId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const user = await fetchPublicUser(String(input.githubId))
      if (!user) return null
      return {
        login: user.login,
        avatarUrl: user.avatar_url,
        htmlUrl: user.html_url,
        accountCreatedAt: user.created_at,
      }
    }),

  approve: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const approved = await approveOne(input.userId, ctx.user.id)
      if (!approved) {
        throw trpcError({
          code: "access.user_not_found",
          status: 404,
          message: "That user no longer exists.",
        })
      }
      return { approved: approved.newlyApproved }
    }),

  reject: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .update(userTable)
        .set({
          accessStatus: "rejected",
          accessReviewedAt: new Date(),
          accessReviewedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, input.userId))
        .returning({ id: userTable.id })
      if (!row) {
        throw trpcError({
          code: "access.user_not_found",
          status: 404,
          message: "That user no longer exists.",
        })
      }
      return { rejected: true }
    }),

  bulkApprove: adminProcedure
    .input(z.object({ userIds: z.array(z.string().min(1)).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      // Flip only rows that aren't already approved, so re-running a bulk
      // action doesn't re-stamp reviewer/time or re-enqueue emails.
      const flipped = await db
        .update(userTable)
        .set({
          accessStatus: "approved",
          accessReviewedAt: new Date(),
          accessReviewedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(userTable.id, input.userIds),
            sql`${userTable.accessStatus} <> 'approved'`
          )
        )
        .returning({ id: userTable.id })

      // One event per newly-approved user. The Inngest job + Email SDK both
      // key on the user id, so a retry of this send never double-emails.
      await Promise.all(
        flipped.map((row) =>
          inngest
            .send({ name: "access/approved", data: { userId: row.id } })
            .catch((err) =>
              console.error("[access] failed to enqueue approval email:", err)
            )
        )
      )

      return { approvedCount: flipped.length }
    }),
} satisfies TRPCRouterRecord

async function approveOne(
  userId: string,
  reviewerId: string
): Promise<{ newlyApproved: boolean } | null> {
  const [existing] = await db
    .select({ accessStatus: userTable.accessStatus })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  if (!existing) return null

  if (existing.accessStatus === "approved") {
    return { newlyApproved: false }
  }

  await db
    .update(userTable)
    .set({
      accessStatus: "approved",
      accessReviewedAt: new Date(),
      accessReviewedBy: reviewerId,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  await inngest
    .send({ name: "access/approved", data: { userId } })
    .catch((err) =>
      console.error("[access] failed to enqueue approval email:", err)
    )

  return { newlyApproved: true }
}
