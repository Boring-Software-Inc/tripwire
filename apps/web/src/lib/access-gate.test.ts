import { describe, expect, it, vi } from "vitest"
import {
  accessDenialFor,
  applySignupAccessDefaults,
  canTrustSessionStatus,
  gateFromFlag,
  resolveEffectiveStatus,
} from "@tripwire/auth/access"

// These exercise the real decision logic used by the signup create hook
// (packages/auth) and the tRPC access gate (integrations/trpc/init.ts), kept
// pure so they run without a database. See the four required invariants.

describe("waitlist access gate", () => {
  describe("signup defaults — invariant 1 (default) & 2 (server-assigned only)", () => {
    it("defaults a new GitHub signup to pending", () => {
      const out = applySignupAccessDefaults({ email: "a@b.com" }, null)
      expect(out.accessStatus).toBe("pending")
    })

    it("ignores any client-supplied accessStatus — cannot self-approve", () => {
      const out = applySignupAccessDefaults(
        {
          email: "a@b.com",
          accessStatus: "approved",
          accessReviewedBy: "self",
        } as Record<string, unknown>,
        null,
      )
      expect(out.accessStatus).toBe("pending")
    })

    it("stamps the pre-launch waitlist timestamp when present", () => {
      const t = new Date("2025-01-01T00:00:00Z")
      expect(applySignupAccessDefaults({ email: "a@b.com" }, t).waitlistedAt).toBe(t)
    })
  })

  describe("API gate rejection — invariant 3", () => {
    it("denies pending sessions with FORBIDDEN", () => {
      expect(accessDenialFor("pending")).toMatchObject({ code: "FORBIDDEN" })
    })

    it("denies rejected sessions with FORBIDDEN", () => {
      expect(accessDenialFor("rejected")).toMatchObject({ code: "FORBIDDEN" })
    })

    it("lets approved sessions through", () => {
      expect(accessDenialFor("approved")).toBeNull()
    })
  })

  describe("promotion visible without reauth — invariant 4", () => {
    it("re-reads the DB when the cached session is not yet approved", async () => {
      const read = vi.fn().mockResolvedValue("approved")
      // Session cookie still says "pending", but the admin just promoted them.
      const status = await resolveEffectiveStatus("pending", read)
      expect(status).toBe("approved")
      expect(read).toHaveBeenCalledOnce()
    })

    it("trusts an approved session without hitting the DB", async () => {
      const read = vi.fn().mockResolvedValue("pending")
      const status = await resolveEffectiveStatus("approved", read)
      expect(status).toBe("approved")
      expect(read).not.toHaveBeenCalled()
    })

    it("defaults to pending when the user row is missing", async () => {
      const status = await resolveEffectiveStatus("pending", async () => null)
      expect(status).toBe("pending")
    })

    it("canTrustSessionStatus only trusts approved", () => {
      expect(canTrustSessionStatus("approved")).toBe(true)
      expect(canTrustSessionStatus("pending")).toBe(false)
      expect(canTrustSessionStatus("rejected")).toBe(false)
      expect(canTrustSessionStatus(null)).toBe(false)
    })
  })

  describe("gate flag resolution — Databuddy primary, env fallback", () => {
    it("trusts a resolved flag (enabled) regardless of env", () => {
      expect(gateFromFlag({ enabled: true, reason: "RULE_MATCH" }, false)).toBe(true)
      expect(gateFromFlag({ enabled: false, reason: "RULE_MATCH" }, true)).toBe(false)
    })

    it("falls back to env when the flag doesn't exist yet (NOT_FOUND)", () => {
      expect(gateFromFlag({ enabled: false, reason: "NOT_FOUND" }, true)).toBe(true)
      expect(gateFromFlag({ enabled: false, reason: "NOT_FOUND" }, false)).toBe(false)
    })

    it("falls back to env on Databuddy error / pending session", () => {
      expect(gateFromFlag({ enabled: false, reason: "ERROR" }, true)).toBe(true)
      expect(gateFromFlag({ enabled: false, reason: "SESSION_PENDING" }, true)).toBe(true)
    })

    it("falls back to env when the lookup threw (null flag)", () => {
      expect(gateFromFlag(null, true)).toBe(true)
      expect(gateFromFlag(null, false)).toBe(false)
    })
  })
})
