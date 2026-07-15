import { createEmailClient } from "@opencoredev/email-sdk"
import { resend } from "@opencoredev/email-sdk/resend"
import { env } from "@tripwire/env/server"

export type { EmailMessage } from "@opencoredev/email-sdk"
export { EmailValidationError } from "@opencoredev/email-sdk"

if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required in production")
}

// Single shared transactional client. Resend is the only adapter for now;
// the SDK keeps provider choice a config change, so adding a fallback later
// (e.g. Postmark) touches this file and nothing that calls `email.send`.
// `retry: { retries: 2 }` only retries transient failures (5xx, 429,
// network) with exponential backoff — validation errors fail immediately.
export const email = createEmailClient({
  adapters: [resend({ apiKey: env.RESEND_API_KEY ?? "" })],
  retry: { retries: 2 },
})

export const EMAIL_FROM = env.EMAIL_FROM

/** True when a real provider key is configured. Lets callers no-op in local
 * dev instead of throwing on a missing key. */
export const isEmailConfigured = Boolean(env.RESEND_API_KEY)
