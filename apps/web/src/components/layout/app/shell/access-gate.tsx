import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "#/integrations/trpc/react"
import { AccessPendingScreen } from "#/components/layout/auth/access-pending-screen"

function GateSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-tw-bg">
      <div className="size-5 animate-spin rounded-full border-2 border-tw-accent border-t-transparent" />
    </div>
  )
}

/**
 * Access boundary. For a gated, not-yet-approved user this REPLACES the app
 * shell with the waitlist screen — the dashboard (and its repo/workspace
 * queries) never mount, so there's no flash of "Install Tripwire…" before a
 * redirect. Sits under `AuthProvider` (needs the session) and above the
 * workspace/chat providers.
 *
 * The decision comes from `auth.me.gateEnabled` — the SAME server-side flag
 * evaluation the API gate (`approvedProcedure`) uses, including the env
 * fallback — so the client can never disagree with what the server enforces.
 * The server remains the real boundary; this only prevents the flash.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const trpc = useTRPC()
  const me = useQuery(
    trpc.auth.me.queryOptions(undefined, { staleTime: 30_000 })
  )

  const data = me.data

  // Approved users are never gated — render the shell immediately.
  if (data?.accessStatus === "approved") return <>{children}</>

  // Still resolving — hold on a neutral loader, never the shell.
  if (me.isLoading) return <GateSpinner />

  // Not logged in (AuthProvider handles the redirect to /login).
  if (!data) return <>{children}</>

  // Gate on (status is already known non-approved here) → replace the
  // dashboard with the waitlist screen.
  if (data.gateEnabled) {
    return (
      <AccessPendingScreen
        email={data.email}
        image={data.image}
        status={data.accessStatus}
      />
    )
  }

  // Gate off → render the shell as normal.
  return <>{children}</>
}
