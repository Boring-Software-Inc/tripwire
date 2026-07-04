import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState, useCallback } from "react"
import { buildSeo } from "#/lib/seo"
import { authClient } from "@tripwire/auth/client"
import { LandingHeader } from "#/components/layout/landing/header"
import { useSpaceInvaders } from "#/components/layout/landing/space-invaders"
import { RetroComputer } from "#/components/layout/landing/retro-computer"

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: "Tripwire — catch slop before it catches up with you",
      description:
        "Open source GitHub moderation for spam PRs, bot accounts, and AI-generated contributions. Rules that run on every webhook so maintainers don't have to.",
      type: "website",
    }),
})

function LandingPage() {
  const { data: session } = authClient.useSession()
  const [gameActive, setGameActive] = useState(false)

  const exitGame = useCallback(() => setGameActive(false), [])

  // The game boots straight onto the retro computer's CRT, replacing the
  // dashboard demo — the terminal backdrop stays put.
  const gameCanvas = useSpaceInvaders(gameActive, exitGame)

  useEffect(() => {
    if (gameActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow")) setGameActive(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [gameActive])

  return (
    // The classic Windows 98 desktop teal — the stage for what comes next.
    <div
      className="relative h-screen w-full overflow-hidden antialiased [font-synthesis:none]"
      style={{ background: "#008080" }}
    >
      {/* Hero — dead centre, above the machine */}
      <div className="relative z-10 flex h-full w-full flex-col">
        <LandingHeader session={session} />
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4">
          <h1 className="font-sans text-lg font-medium text-tw-text-primary">
            catch slop before it catches up with you
          </h1>
          {session ? (
            <Link
              to="/home"
              className="flex h-7 items-center rounded-lg bg-white px-2.5 text-[14px] font-medium text-black shadow-sm transition-colors hover:bg-white/90"
            >
              get started
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex h-7 items-center rounded-lg bg-white px-2.5 text-[14px] font-medium text-black shadow-sm transition-colors hover:bg-white/90"
            >
              login
            </Link>
          )}
        </div>
      </div>

      {/* The machine peeks up from the fold under the hero */}
      <div
        className="absolute inset-x-0 bottom-0 z-0 flex justify-center px-4"
        style={{ transform: "translateY(58%)" }}
      >
        <RetroComputer gameCanvas={gameActive ? gameCanvas : null} />
      </div>
    </div>
  )
}
