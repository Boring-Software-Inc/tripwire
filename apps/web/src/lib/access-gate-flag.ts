import { createServerFlagsManager } from "@databuddy/sdk/node"
import { env } from "@tripwire/env/server"
import { isTruthy } from "@tripwire/env/boolean"
import { gateFromFlag } from "@tripwire/auth/access"
import { DATABUDDY_CLIENT_ID, FLAGS } from "#/lib/databuddy"

/**
 * Server-side evaluation of the closed-beta access gate. **Server-only** — this
 * imports `@databuddy/sdk/node`; never import it into a client bundle.
 *
 * Databuddy's `access-gate` flag is the primary control (toggle it from the
 * dashboard, no redeploy). If Databuddy is unreachable or the flag doesn't
 * exist yet, we fall back to the `ACCESS_GATE_ENABLED` env var — a local
 * kill-switch so the security boundary never hard-depends on an external
 * service (per the chosen fallback policy).
 */
const flags = createServerFlagsManager({ clientId: DATABUDDY_CLIENT_ID })

function envFallback(): boolean {
  return isTruthy(env.ACCESS_GATE_ENABLED)
}

export async function isAccessGateEnabled(user?: {
  userId?: string
  email?: string
}): Promise<boolean> {
  try {
    const flag = await flags.getFlag(FLAGS.accessGate, user)
    return gateFromFlag(flag, envFallback())
  } catch {
    // Network / SDK error — getFlag rejects. Fall back to the env kill-switch.
    return gateFromFlag(null, envFallback())
  }
}
