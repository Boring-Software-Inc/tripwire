import { and, eq, isNotNull, or } from "drizzle-orm"
import { createError } from "evlog"
import { db } from "@tripwire/db/client"
import {
  contributorRequests,
  events,
  member,
  organizations,
  repositories,
} from "@tripwire/db"

const NOT_FOUND = () =>
  createError({
    code: "resource.not_found",
    status: 404,
    message: "Not found",
  })

/**
 * Confirm `userId` owns the Tripwire `orgId` (GitHub App installation).
 * Throws `resource.not_found` otherwise. Returns the org row.
 */
export async function assertOrgOwner(userId: string, orgId: string) {
  const [row] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.ownerId, userId)))
    .limit(1)
  if (!row) throw NOT_FOUND()
  return row
}

/**
 * Confirm `userId` owns the org that owns `repoId`. Returns both rows.
 */
export async function assertRepoOwner(userId: string, repoId: string) {
  const [row] = await db
    .select({ repo: repositories, org: organizations })
    .from(repositories)
    .innerJoin(organizations, eq(repositories.orgId, organizations.id))
    .where(and(eq(repositories.id, repoId), eq(organizations.ownerId, userId)))
    .limit(1)
  if (!row) throw NOT_FOUND()
  return row
}

/**
 * Confirm `userId` owns the repo that emitted `eventId`. Returns the event,
 * its repo, and the owning org.
 */
export async function assertEventOwner(userId: string, eventId: string) {
  const [row] = await db
    .select({ event: events, repo: repositories, org: organizations })
    .from(events)
    .innerJoin(repositories, eq(events.repoId, repositories.id))
    .innerJoin(organizations, eq(repositories.orgId, organizations.id))
    .where(and(eq(events.id, eventId), eq(organizations.ownerId, userId)))
    .limit(1)
  if (!row) throw NOT_FOUND()
  return row
}

/**
 * Confirm `userId` may act on `repoId` — passes if the user OWNS the GitHub
 * App installation OR is a member of the Better Auth workspace the
 * installation is linked to (`organizations.betterAuthOrgId`). This is the
 * access gate for the tool surfaces (chat + MCP): a workspace teammate who
 * doesn't personally own the install can still manage its repos, matching
 * how the web app scopes access. Throws `resource.not_found` otherwise.
 * Returns the repo and owning org rows (same shape as assertRepoOwner).
 */
export async function assertRepoMember(userId: string, repoId: string) {
  const [row] = await db
    .select({ repo: repositories, org: organizations })
    .from(repositories)
    .innerJoin(organizations, eq(repositories.orgId, organizations.id))
    .leftJoin(
      member,
      and(
        eq(member.organizationId, organizations.betterAuthOrgId),
        eq(member.userId, userId)
      )
    )
    .where(
      and(
        eq(repositories.id, repoId),
        or(eq(organizations.ownerId, userId), isNotNull(member.id))
      )
    )
    .limit(1)
  if (!row) throw NOT_FOUND()
  return row
}

/**
 * Like assertEventOwner, but passes if `userId` owns the emitting repo's
 * installation OR is a member of its workspace. Used by `get_event`, which
 * derives its repo from the eventId rather than a passed repoId.
 */
export async function assertEventMember(userId: string, eventId: string) {
  const [row] = await db
    .select({ event: events, repo: repositories, org: organizations })
    .from(events)
    .innerJoin(repositories, eq(events.repoId, repositories.id))
    .innerJoin(organizations, eq(repositories.orgId, organizations.id))
    .leftJoin(
      member,
      and(
        eq(member.organizationId, organizations.betterAuthOrgId),
        eq(member.userId, userId)
      )
    )
    .where(
      and(
        eq(events.id, eventId),
        or(eq(organizations.ownerId, userId), isNotNull(member.id))
      )
    )
    .limit(1)
  if (!row) throw NOT_FOUND()
  return row
}

/**
 * Confirm `userId` owns the repo that received `requestId`. Returns the
 * contributor request, its repo, and the owning org.
 */
export async function assertRequestOwner(userId: string, requestId: string) {
  const [row] = await db
    .select({
      request: contributorRequests,
      repo: repositories,
      org: organizations,
    })
    .from(contributorRequests)
    .innerJoin(repositories, eq(contributorRequests.repoId, repositories.id))
    .innerJoin(organizations, eq(repositories.orgId, organizations.id))
    .where(
      and(
        eq(contributorRequests.id, requestId),
        eq(organizations.ownerId, userId)
      )
    )
    .limit(1)
  if (!row) throw NOT_FOUND()
  return row
}
