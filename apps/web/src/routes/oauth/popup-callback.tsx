import { useEffect, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@tripwire/auth/client"
import { track } from "@databuddy/sdk"
import { env } from "@tripwire/env/client"
import { Button } from "@tripwire/ui/button"
import { TripwireLogo } from "@tripwire/ui/icons/tripwire-logo"
import { useTRPC } from "#/integrations/trpc/react"
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

/**
 * Post-auth closer page for the waitlist popup. GitHub redirects here after
 * sign-in; it reads the user's access status and notifies the opener via
 * postMessage (STRICT target origin). It then shows a confirmation and lets the
 * user close the window themselves — we don't auto-close it.
 *
 * If there's no reachable opener — popup was blocked and this is a full-page
 * redirect, or COOP severed window.opener — it falls back to navigating in
 * place (there's no popup to close in that case).
 */
export const Route = createFileRoute("/oauth/popup-callback")({
  component: PopupCallbackPage,
  headers: () => PRIVATE_ROUTE_HEADERS,
  validateSearch: (
    search: Record<string, unknown>
  ): { opener?: string; error?: string; mode?: string } => ({
    opener: typeof search.opener === "string" ? search.opener : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Finishing up"),
      description: "Completing your Tripwire waitlist request.",
      robots: "noindex",
    }),
})

/** Message channel name shared with the landing-site listener. */
const MESSAGE_TYPE = "tripwire:waitlist"

/** Exact origin to postMessage to, or null if `opener` isn't allowlisted. */
function resolveTargetOrigin(opener: string | undefined): string | null {
  const allowed = (env.VITE_WAITLIST_OPENER_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
  return opener && allowed.includes(opener) ? opener : null
}

/**
 * Approved users: send the opener (the main tab) into the app home, then close
 * the popup. Navigating a cross-origin opener is allowed (it's navigation, not
 * a read). No reachable opener → navigate this window instead.
 */
function launchApp(): void {
  const home = `${window.location.origin}/home`
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = home
      window.close()
      return
    }
  } catch {
    // Opener not navigable — fall through to navigating this window.
  }
  window.location.href = home
}

/** Post to the opener at an exact origin. Returns false if unreachable. */
function postToOpener(payload: unknown, targetOrigin: string | null): boolean {
  if (!targetOrigin) return false
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, targetOrigin)
      return true
    }
  } catch {
    // Cross-origin opener severed (e.g. COOP) — fall through to in-place nav.
  }
  return false
}

type View =
  | { kind: "working" }
  | { kind: "waitlisted"; email: string | null }
  | { kind: "approved" }
  | { kind: "error" }

function PopupCallbackPage() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const { opener, error, mode } = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()
  const me = useQuery(trpc.auth.me.queryOptions(undefined, { staleTime: 0 }))
  const done = useRef(false)
  const [view, setView] = useState<View>({ kind: "working" })

  useEffect(() => {
    if (done.current) return
    const targetOrigin = resolveTargetOrigin(opener)
    // `mode=popup` (stamped by the landing, threaded through OAuth) is the popup
    // detector — NOT window.opener, which a COOP header could sever silently and
    // recreate the dash-in-popup bug. window.opener is the delivery check only.
    const inPopup = mode === "popup"

    // In a popup but couldn't deliver → allowlist drift or a severed opener.
    // Report it so the next misconfig is a dashboard blip, not a user complaint.
    const report = (posted: boolean) => {
      if (inPopup && !posted) {
        track("waitlist_notify_failed", {
          opener: opener ?? "unknown",
          reason: targetOrigin ? "opener_unreachable" : "origin_not_allowlisted",
        })
      }
    }

    // OAuth reported an error (e.g. user cancelled on GitHub's consent screen).
    if (error) {
      done.current = true
      report(postToOpener({ type: MESSAGE_TYPE, status: "error" }, targetOrigin))
      if (inPopup) {
        setView({ kind: "error" })
      } else {
        navigate({ to: "/login", search: { error } })
      }
      return
    }

    // Wait until we know the authoritative status before notifying.
    if (isPending || me.isLoading) return
    done.current = true

    if (!session || !me.data) {
      report(postToOpener({ type: MESSAGE_TYPE, status: "error" }, targetOrigin))
      if (inPopup) {
        setView({ kind: "error" })
      } else {
        navigate({ to: "/login" })
      }
      return
    }

    const status = me.data.accessStatus
    report(
      postToOpener(
        { type: MESSAGE_TYPE, status, name: session.user.name ?? null },
        targetOrigin
      )
    )
    if (inPopup) {
      // In a popup: ALWAYS show the confirmation + Close, even if the opener
      // couldn't be notified. NEVER render the dashboard inside the popup.
      setView(
        status === "approved"
          ? { kind: "approved" }
          : { kind: "waitlisted", email: session.user.email ?? null }
      )
      return
    }
    // True full-page flow (popup blocked → redirect): continue in place.
    navigate({ to: status === "approved" ? "/home" : "/queue" })
  }, [error, isPending, me.isLoading, me.data, session, opener, mode, navigate])

  if (view.kind === "working") {
    return (
      <Shell>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-tw-accent border-t-transparent" />
      </Shell>
    )
  }

  if (view.kind === "error") {
    return (
      <Shell>
        <Heading>Something went wrong</Heading>
        <Body>We couldn&apos;t finish your request. Close this and try again.</Body>
        <CloseButton />
      </Shell>
    )
  }

  if (view.kind === "approved") {
    return (
      <Shell>
        <Heading>You&apos;re in</Heading>
        <Body>Your account already has access.</Body>
        <div className="flex flex-col items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={launchApp}
            className="border-[#CDCDCD] bg-white text-black hover:bg-white/90"
          >
            Launch app
          </Button>
          <button
            type="button"
            onClick={() => window.close()}
            className="text-[12px] text-tw-text-tertiary underline-offset-2 hover:text-tw-text-secondary hover:underline"
          >
            Close window
          </button>
        </div>
      </Shell>
    )
  }

  // waitlisted
  return (
    <Shell>
      <Heading>You&apos;re on the waitlist</Heading>
      <Body>
        Tripwire is in closed beta. We&apos;ll email{" "}
        {view.email ? (
          <span className="text-white">{view.email}</span>
        ) : (
          "you"
        )}{" "}
        when you&apos;re approved.
      </Body>
      <p className="text-[13px] text-tw-text-secondary">
        You can close this window.
      </p>
      <CloseButton />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-5 bg-[#191919] px-8 antialiased [font-synthesis:none]">
      <TripwireLogo className="h-9 w-9 text-white" />
      {children}
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[17px] font-semibold text-white">{children}</h1>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[340px] text-center text-[13px] leading-relaxed text-tw-text-secondary">
      {children}
    </p>
  )
}

function CloseButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.close()}
      className="border-[#CDCDCD] bg-white text-black hover:bg-white/90"
    >
      Close window
    </Button>
  )
}
