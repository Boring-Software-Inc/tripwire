import { useEffect } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "#/integrations/trpc/react"

/**
 * Client-side companion to the server access gate. Bounces pending/rejected
 * users to /queue when the gate is enabled. The server (`approvedProcedure`)
 * is the real enforcement — this just avoids showing a broken _app shell
 * whose data calls would all 403. Reads `accessGateEnabled` from `auth.me`
 * so the flag stays a single server-owned source of truth.
 */
export function useAccessGate() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const trpc = useTRPC()
  const me = useQuery(trpc.auth.me.queryOptions(undefined, { staleTime: 30_000 }))

  useEffect(() => {
    if (me.isLoading) return
    if (pathname.startsWith("/queue")) return
    if (pathname.startsWith("/login")) return
    if (pathname.startsWith("/api")) return
    const data = me.data
    if (!data) return
    if (!data.accessGateEnabled) return
    if (data.accessStatus !== "approved") {
      navigate({ to: "/queue" })
    }
  }, [pathname, me.isLoading, me.data, navigate])
}
