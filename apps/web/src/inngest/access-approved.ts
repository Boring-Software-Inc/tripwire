import { eq } from "drizzle-orm"
import { db } from "@tripwire/db/client"
import { user as userTable } from "@tripwire/db"
import { email, isEmailConfigured, EmailValidationError } from "@tripwire/email"
import { accessApprovedEmail } from "@tripwire/email/templates"
import { inngest } from "./client"

/**
 * Sends the "you're in" email when an access request is approved. Retryable
 * (transient send failures) and idempotent at two layers: Inngest dedupes on
 * the event's `userId`, and the Email SDK is handed a stable idempotency key
 * so a retried send never delivers a second copy. A bulk approve therefore
 * can't double-email even if the job re-runs.
 */
export const sendAccessApprovedEmail = inngest.createFunction(
  {
    id: "access-approved-email",
    triggers: [{ event: "access/approved" }],
    idempotency: "event.data.userId",
    retries: 3,
  },
  async ({ event, step }) => {
    const { userId } = event.data

    const recipient = await step.run("load-user", async () => {
      const [row] = await db
        .select({
          email: userTable.email,
          name: userTable.name,
          accessStatus: userTable.accessStatus,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
      return row ?? null
    })

    // Guard against a race where the user was rejected/deleted between the
    // event firing and this step. Only email people who are actually approved.
    if (!recipient || recipient.accessStatus !== "approved") {
      return { sent: false, reason: "not-approved" }
    }

    if (!isEmailConfigured) {
      console.warn(
        `[access-approved-email] RESEND_API_KEY unset — skipping email to ${recipient.email}`
      )
      return { sent: false, reason: "email-not-configured" }
    }

    const result = await step.run("send", async () => {
      try {
        const res = await email.send(
          accessApprovedEmail({ to: recipient.email, name: recipient.name }),
          { idempotencyKey: `access-approved:${userId}` }
        )
        return { provider: res.provider, id: res.id ?? res.messageId ?? null }
      } catch (err) {
        // Validation errors (bad address, unsupported field) are permanent —
        // retrying wastes attempts, so swallow them into a terminal result.
        if (err instanceof EmailValidationError) {
          console.error(
            `[access-approved-email] validation error for ${recipient.email}:`,
            err.message
          )
          return { provider: null, id: null, failed: true as const }
        }
        throw err
      }
    })

    return { sent: !("failed" in result), ...result }
  }
)
