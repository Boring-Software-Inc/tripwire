import type { AccessStatus } from "@tripwire/db"

/**
 * Pure access-queue decision helpers, kept free of DB/env side effects so they
 * can be unit-tested and shared between the auth package (signup create hook)
 * and the app's tRPC gate (`integrations/trpc/init.ts`). No new access concept
 * is introduced here — this only factors out logic that already existed inline.
 */

/**
 * Force server-assigned access defaults onto a new signup, regardless of
 * anything the client sent. New GitHub signups always land in the approval
 * queue as "pending" (never trust a client-supplied `accessStatus`), and
 * `waitlistedAt` is stamped from the pre-launch email waitlist.
 *
 * Pairs with `input: false` on the Better Auth `additionalFields` — that stops
 * the field being accepted off the wire; this guarantees the create-path value.
 */
export function applySignupAccessDefaults<T extends object>(
  input: T,
  waitlistedAt: Date | null
): T & { accessStatus: AccessStatus; waitlistedAt: Date | null } {
  return {
    ...input,
    accessStatus: "pending",
    waitlistedAt,
  } as T & { accessStatus: AccessStatus; waitlistedAt: Date | null }
}

/**
 * Whether the cookie-cached session status can be trusted without a fresh DB
 * read. Only "approved" is trusted; any other value is re-read so an admin
 * promotion made mid-session takes effect on the user's next request without
 * them re-authenticating (see the invariant-4 decision in the plan).
 */
export function canTrustSessionStatus(
  sessionStatus: AccessStatus | null | undefined
): boolean {
  return sessionStatus === "approved"
}

/**
 * Resolve the authoritative status: trust an "approved" session copy, else read
 * from the DB via the injected reader. Callers supply the DB read so this stays
 * pure and testable; a `null` read (missing row) defaults to "pending".
 */
export async function resolveEffectiveStatus(
  sessionStatus: AccessStatus | null | undefined,
  readFromDb: () => Promise<AccessStatus | null>
): Promise<AccessStatus> {
  if (canTrustSessionStatus(sessionStatus)) return "approved"
  return (await readFromDb()) ?? "pending"
}

/**
 * Databuddy flag reasons that mean "not authoritatively resolved" — the flag
 * doesn't exist, the service errored, or the session isn't ready. In these
 * cases the caller should fall back to the env kill-switch rather than trust
 * the (false) `enabled` value. A thrown getFlag rejection maps to `null` here.
 */
export const GATE_FALLBACK_REASONS = new Set([
  "ERROR",
  "NOT_FOUND",
  "SESSION_PENDING",
])

/**
 * Resolve the access gate from a Databuddy flag result, falling back to the env
 * kill-switch when Databuddy couldn't authoritatively resolve it (unresolved
 * reason, or `null` for a thrown lookup). Pure so it's unit-testable without
 * the SDK/network.
 */
export function gateFromFlag(
  flag: { enabled: boolean; reason: string } | null | undefined,
  envFallback: boolean
): boolean {
  if (!flag || GATE_FALLBACK_REASONS.has(flag.reason)) return envFallback
  return flag.enabled
}

export interface AccessDenial {
  code: "FORBIDDEN"
  message: string
}

/**
 * The gate decision for a resolved status. Returns `null` when the user may
 * proceed (approved), or a FORBIDDEN denial for pending/rejected users. The
 * caller is responsible for only invoking the gate when it's enabled.
 */
export function accessDenialFor(status: AccessStatus): AccessDenial | null {
  if (status === "approved") return null
  return {
    code: "FORBIDDEN",
    message:
      status === "rejected"
        ? "Your access request was not approved."
        : "Your access request is still pending review.",
  }
}
