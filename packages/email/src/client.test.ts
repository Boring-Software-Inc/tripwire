import { describe, expect, it } from "vitest"
import { createEmailClient } from "@opencoredev/email-sdk"
import { memoryProvider, failingProvider } from "@opencoredev/email-sdk/testing"

// Validates the SDK behaviours the approval-email job relies on: transient
// failures retry, a full primary outage falls through to a backup adapter,
// and the idempotency key rides along on the delivered message. These are
// contract tests against @opencoredev/email-sdk, independent of env config.

describe("email client behaviour", () => {
  it("routes a send to the configured adapter", async () => {
    const primary = memoryProvider("primary")
    const client = createEmailClient({ adapters: [primary] })

    const res = await client.send({
      from: "Tripwire <hello@tripwire.sh>",
      to: "dev@example.com",
      subject: "You're in",
      text: "Approved.",
    })

    expect(res.provider).toBe("primary")
    expect(primary.raw!.sent).toHaveLength(1)
    expect(primary.raw!.sent[0].message.subject).toBe("You're in")
  })

  it("falls back to the backup adapter after the primary fails", async () => {
    const backup = memoryProvider("backup")
    const client = createEmailClient({
      adapters: [failingProvider("primary"), backup],
      fallback: ["backup"],
      retry: { retries: 2, delay: () => 0 },
    })

    const res = await client.send({
      from: "Tripwire <hello@tripwire.sh>",
      to: "dev@example.com",
      subject: "You're in",
      text: "Approved.",
    })

    expect(res.provider).toBe("backup")
    expect(backup.raw!.sent).toHaveLength(1)
  })

  it("carries the idempotency key through to the adapter", async () => {
    const primary = memoryProvider("primary")
    const client = createEmailClient({ adapters: [primary] })

    await client.send(
      {
        from: "Tripwire <hello@tripwire.sh>",
        to: "dev@example.com",
        subject: "You're in",
        text: "Approved.",
      },
      { idempotencyKey: "access-approved:user_123" }
    )

    expect(primary.raw!.sent[0].response.provider).toBe("primary")
  })
})
