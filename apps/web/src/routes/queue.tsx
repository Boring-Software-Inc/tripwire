import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@tripwire/auth/client"
import { Button } from "@tripwire/ui/button"
import { TripwireLogo } from "@tripwire/ui/icons/tripwire-logo"
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

  const status = me.data?.accessStatus ?? "pending"
  const rejected = status === "rejected"

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-tw-bg px-4 py-10 antialiased">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-8">
        <TripwireLogo className="size-8 text-tw-text-primary" />

        <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-tw-border bg-tw-card p-8 text-center">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              className="size-14 rounded-full border border-tw-border"
            />
          ) : null}

          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-semibold text-tw-text-primary">
              {session.user.name}
            </p>
            <p className="text-[13px] text-tw-text-muted">
              {session.user.email}
            </p>
          </div>

          {rejected ? (
            <div className="flex flex-col gap-2">
              <h1 className="text-[16px] font-semibold text-tw-text-primary">
                Not this time
              </h1>
              <p className="text-[13px] leading-relaxed text-tw-text-secondary">
                Your access request wasn't approved. Thanks for your interest in
                Tripwire — feel free to check back as we open up more broadly.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h1 className="text-[16px] font-semibold text-tw-text-primary">
                You're in the queue
              </h1>
              <p className="text-[13px] leading-relaxed text-tw-text-secondary">
                Thanks for requesting access with GitHub. We review requests
                manually — we'll email{" "}
                <span className="text-tw-text-primary">
                  {session.user.email}
                </span>{" "}
                the moment you're approved.
              </p>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => authClient.signOut()}
          className="text-[12px] text-tw-text-tertiary hover:text-tw-text-secondary"
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
