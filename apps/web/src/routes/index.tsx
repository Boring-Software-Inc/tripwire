import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { authClient } from "@tripwire/auth/client"
import { buildSeo } from "#/lib/seo"

// The marketing landing page lives in the tripwire-landing repo. The app
// domain's root just routes people to the right place by session.
export const Route = createFileRoute("/")({
  component: IndexRedirect,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: "Tripwire",
      description:
        "Open source GitHub moderation for spam PRs, bot accounts, and AI-generated contributions.",
      robots: "noindex",
    }),
})

function IndexRedirect() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (isPending) return
    navigate({ to: session ? "/home" : "/login", replace: true })
  }, [isPending, session, navigate])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-tw-bg">
      <div className="size-5 animate-spin rounded-full border-2 border-tw-accent border-t-transparent" />
    </div>
  )
}
