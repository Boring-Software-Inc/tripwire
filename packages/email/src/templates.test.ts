import { describe, expect, it, vi } from "vitest"

vi.mock("@tripwire/env/server", () => ({
  env: {
    NODE_ENV: "test",
    RESEND_API_KEY: undefined,
    EMAIL_FROM: "Tripwire <hello@tripwire.sh>",
    APP_URL: "https://tripwire.sh",
  },
}))

import { accessApprovedEmail } from "./templates"

describe("accessApprovedEmail", () => {
  it("addresses the recipient by first name and links to sign-in", () => {
    const msg = accessApprovedEmail({
      to: "dev@example.com",
      name: "Ada Lovelace",
    })

    expect(msg.to).toBe("dev@example.com")
    expect(msg.from).toBe("Tripwire <hello@tripwire.sh>")
    expect(msg.subject).toContain("approved")
    expect(msg.text).toContain("Hi Ada,")
    expect(msg.text).toContain("https://tripwire.sh/login")
    expect(msg.html).toContain("https://tripwire.sh/login")
  })

  it("falls back to a generic greeting when name is empty", () => {
    const msg = accessApprovedEmail({ to: "dev@example.com", name: "" })
    expect(msg.text).toContain("Hi there,")
  })
})
