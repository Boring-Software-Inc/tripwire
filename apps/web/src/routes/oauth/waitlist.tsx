import { useEffect, useRef } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { authClient } from "@tripwire/auth/client"
import { TripwireLogo } from "@tripwire/ui/icons/tripwire-logo"
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

/**
 * Popup entry point for the cross-deployment "Join waitlist with GitHub" flow.
 * The landing site opens this route in a popup; it kicks off the existing
 * GitHub social sign-in and points the OAuth callback at the closer page,
 * threading through the opener origin so the closer knows exactly which window
 * (and origin) to notify. This is standard OAuth machinery, hence /oauth/*.
 */
export const Route = createFileRoute("/oauth/waitlist")({
  component: WaitlistEntryPage,
  headers: () => PRIVATE_ROUTE_HEADERS,
  validateSearch: (
    search: Record<string, unknown>
  ): { opener?: string; mode?: string } => ({
    opener: typeof search.opener === "string" ? search.opener : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Join the waitlist"),
      description: "Request Tripwire access with GitHub.",
      robots: "noindex",
    }),
})

function callbackPath(
  opener: string | undefined,
  mode: string | undefined,
  error?: string
): string {
  const params = new URLSearchParams()
  if (opener) params.set("opener", opener)
  // Thread the popup marker through OAuth so the closer knows it's a popup even
  // if window.opener is later severed (COOP). See the closer's inPopup logic.
  if (mode) params.set("mode", mode)
  if (error) params.set("error", error)
  const qs = params.toString()
  return `/oauth/popup-callback${qs ? `?${qs}` : ""}`
}

function WaitlistEntryPage() {
  const navigate = useNavigate()
  const { opener, mode } = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()
  const started = useRef(false)

  useEffect(() => {
    if (isPending || started.current) return
    started.current = true

    // Returning user with a live session: no need to re-auth — hand straight
    // to the closer so it reads their current status and notifies the opener.
    if (session) {
      navigate({ to: "/oauth/popup-callback", search: { opener, mode } })
      return
    }

    // New/returning-without-session: initiate GitHub OAuth in this popup. The
    // access-queue default ("pending") is assigned server-side on user create.
    void authClient.signIn.social({
      provider: "github",
      callbackURL: callbackPath(opener, mode),
      errorCallbackURL: callbackPath(opener, mode, "oauth_failed"),
    })
  }, [isPending, session, opener, mode, navigate])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#191919] antialiased [font-synthesis:none]">
      <TripwireLogo className="h-10 w-10 text-white" />
      <div className="flex items-center gap-3 text-[14px] text-tw-text-secondary">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-tw-accent border-t-transparent" />
        Connecting to GitHub…
      </div>
    </div>
  )
}
