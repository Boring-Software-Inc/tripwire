/**
 * Reverse of backfill-access-status: move every `approved` user back to
 * `pending` (e.g. after everyone was approved by mistake). Clears the review
 * metadata so they read as un-reviewed; leaves `waitlistedAt` intact.
 *
 * SAFE BY DEFAULT: dry-run unless `--apply` is passed. Keeps admins approved
 * unless `--include-admins` is passed (so you don't lock yourself out of the
 * admin panel once the gate is on).
 *
 *   # see what it would do
 *   pnpm --filter @tripwire/web exec tsx scripts/reset-access-status.ts
 *   # actually do it (non-admins only)
 *   pnpm --filter @tripwire/web exec tsx scripts/reset-access-status.ts --apply
 *   # include admins too
 *   pnpm --filter @tripwire/web exec tsx scripts/reset-access-status.ts --apply --include-admins
 */
import { and, eq, ne, sql } from "drizzle-orm"
import { db } from "@tripwire/db/client"
import { user as userTable } from "@tripwire/db"

const APPLY = process.argv.includes("--apply")
const INCLUDE_ADMINS = process.argv.includes("--include-admins")

async function main() {
  const [breakdown] = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${userTable.accessStatus} = 'approved')::int`,
      pending: sql<number>`count(*) filter (where ${userTable.accessStatus} = 'pending')::int`,
      rejected: sql<number>`count(*) filter (where ${userTable.accessStatus} = 'rejected')::int`,
      approvedAdmins: sql<number>`count(*) filter (where ${userTable.accessStatus} = 'approved' and ${userTable.role} = 'admin')::int`,
    })
    .from(userTable)

  console.log("[reset-access-status] current:", breakdown)

  // Target: approved users, excluding admins unless --include-admins.
  const where = INCLUDE_ADMINS
    ? eq(userTable.accessStatus, "approved")
    : and(eq(userTable.accessStatus, "approved"), ne(userTable.role, "admin"))

  if (!APPLY) {
    const targets = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(where)
    console.log(
      `[reset-access-status] DRY RUN — would reset ${targets.length} user(s) to "pending"` +
        `${INCLUDE_ADMINS ? " (including admins)" : " (admins kept approved)"}.` +
        ` Re-run with --apply to execute.`
    )
    return
  }

  const updated = await db
    .update(userTable)
    .set({
      accessStatus: "pending",
      accessReviewedAt: null,
      accessReviewedBy: null,
      updatedAt: new Date(),
    })
    .where(where)
    .returning({ id: userTable.id })

  console.log(
    `[reset-access-status] reset ${updated.length} user(s) to "pending"` +
      `${INCLUDE_ADMINS ? " (including admins)" : " (admins kept approved)"}.`
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[reset-access-status] failed:", err)
    process.exit(1)
  })
