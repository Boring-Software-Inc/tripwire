/**
 * One-time backfill: move every pre-existing user to `approved` so the
 * access gate doesn't lock out people who were already using Tripwire.
 *
 * Run this in the same window as the schema push (rollout step 1), BEFORE
 * turning on ACCESS_GATE_ENABLED. Newly added `access_status` columns default
 * to "pending", so without this every existing user would be gated.
 *
 * Only approves users created before the script started, so it stays safe to
 * re-run even after real pending signups exist.
 *
 *   pnpm --filter @tripwire/web exec tsx scripts/backfill-access-status.ts
 */
import { and, eq, lte } from "drizzle-orm"
import { db } from "@tripwire/db/client"
import { user as userTable } from "@tripwire/db"

async function main() {
  const cutoff = new Date()

  const updated = await db
    .update(userTable)
    .set({ accessStatus: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(userTable.accessStatus, "pending"),
        lte(userTable.createdAt, cutoff)
      )
    )
    .returning({ id: userTable.id })

  console.log(
    `[backfill-access-status] approved ${updated.length} pre-existing user(s).`
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-access-status] failed:", err)
    process.exit(1)
  })
