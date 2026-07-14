/**
 * One-time campaign: email everyone on the legacy `waitlist` table asking
 * them to sign in with GitHub and claim their spot (rollout step 4).
 *
 * Idempotent per address (Email SDK idempotency key), so a re-run inside the
 * same provider window won't double-send. Retire the `waitlist` table and
 * router after the 30-day claim window (rollout step 5).
 *
 *   pnpm --filter @tripwire/web exec tsx scripts/waitlist-migration-email.ts
 */
import { db } from "@tripwire/db/client"
import { waitlist } from "@tripwire/db"
import { email, isEmailConfigured, EMAIL_FROM } from "@tripwire/email"
import { env } from "@tripwire/env/server"

async function main() {
  if (!isEmailConfigured) {
    console.error("[waitlist-migration] RESEND_API_KEY unset — aborting.")
    process.exit(1)
  }

  const rows = await db.select({ email: waitlist.email }).from(waitlist)
  console.log(`[waitlist-migration] sending to ${rows.length} address(es)…`)

  let sent = 0
  let failed = 0
  for (const row of rows) {
    try {
      await email.send(
        {
          from: EMAIL_FROM,
          to: row.email,
          subject: "Claim your Tripwire spot — sign in with GitHub",
          text: [
            "Tripwire access now runs through GitHub sign-in.",
            "",
            `Sign in with GitHub to claim the spot you reserved with ${row.email}:`,
            "",
            `${env.APP_URL}/login`,
            "",
            "Your early signup is flagged for priority review.",
            "",
            "— The Tripwire team",
          ].join("\n"),
        },
        { idempotencyKey: `waitlist-migration:${row.email.toLowerCase()}` }
      )
      sent++
    } catch (err) {
      failed++
      console.error(`[waitlist-migration] failed for ${row.email}:`, err)
    }
  }

  console.log(`[waitlist-migration] done — ${sent} sent, ${failed} failed.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[waitlist-migration] failed:", err)
    process.exit(1)
  })
