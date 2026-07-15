import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@tripwire/auth/client"
import { AccessPendingScreen } from "#/components/layout/auth/access-pending-screen"
import { useTRPC } from "#/integrations/trpc/react"
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

export const Route = createFileRoute("/queue")({
  component: QueuePage,
  headers: () => PRIVATE_ROUTE_HEADERS,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Access queue"),
      description: "Your Tripwire access request status.",
      robots: "noindex",
    }),
})

function QueuePage() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const { data: session, isPending } = authClient.useSession()
  const me = useQuery(
    trpc.auth.me.queryOptions(undefined, { staleTime: 15_000 })
  )

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate({ to: "/login" })
      return
    }
    // Approved users have no business on the queue page — send them onward.
    if (me.data?.accessStatus === "approved") {
      navigate({ to: "/home" })
    }
  }, [isPending, session, me.data?.accessStatus, navigate])

  if (isPending || me.isLoading || !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-tw-bg">
        <div className="size-5 animate-spin rounded-full border-2 border-tw-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <AccessPendingScreen
      email={session.user.email}
      image={session.user.image}
      status={me.data?.accessStatus ?? "pending"}
    />
  )
}
