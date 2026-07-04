import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState, useCallback } from "react"
import { buildSeo } from "#/lib/seo"
import { authClient } from "@tripwire/auth/client"
import { LandingHeader } from "#/components/layout/landing/header"
import { useSpaceInvaders } from "#/components/layout/landing/space-invaders"
import FaultyTerminal from "#/components/layout/landing/faulty-terminal"
import { RetroComputer } from "#/components/layout/landing/retro-computer"
import {
  TRIPWIRE_EYE_OUTER_PATH,
  TRIPWIRE_EYE_OUTER_VIEWBOX,
  TRIPWIRE_EYE_SOCKET_PATH,
  TRIPWIRE_EYE_SOCKET_VIEWBOX,
  TRIPWIRE_EYE_SOCKET_RECT_IN_OUTER,
  TRIPWIRE_EYE_PUPIL_PATH,
  TRIPWIRE_EYE_PUPIL_VIEWBOX,
  TRIPWIRE_EYE_PUPIL_RECT_IN_OUTER,
} from "@tripwire/ui/icons/tripwire-eye"

const EYE_CURSOR_MASK = {
  viewBox: TRIPWIRE_EYE_OUTER_VIEWBOX,
  width: 1.05,
  layers: [
    {
      path: TRIPWIRE_EYE_OUTER_PATH,
      viewBox: TRIPWIRE_EYE_OUTER_VIEWBOX,
      rect: [
        0,
        0,
        TRIPWIRE_EYE_OUTER_VIEWBOX[0],
        TRIPWIRE_EYE_OUTER_VIEWBOX[1],
      ] as const,
      mode: "add" as const,
    },
    {
      path: TRIPWIRE_EYE_SOCKET_PATH,
      viewBox: TRIPWIRE_EYE_SOCKET_VIEWBOX,
      rect: TRIPWIRE_EYE_SOCKET_RECT_IN_OUTER,
      mode: "subtract" as const,
    },
    {
      path: TRIPWIRE_EYE_PUPIL_PATH,
      viewBox: TRIPWIRE_EYE_PUPIL_VIEWBOX,
      rect: TRIPWIRE_EYE_PUPIL_RECT_IN_OUTER,
      mode: "add" as const,
    },
  ],
}

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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-tw-bg antialiased [font-synthesis:none]">
      {/* Terminal — the game renders INSIDE it via the gameCanvas texture */}
      <div className="absolute inset-0 z-0">
        <FaultyTerminal
          scale={3.0}
          digitSize={1.2}
          scanlineIntensity={0.5}
          glitchAmount={gameActive ? 10 : 5}
          flickerAmount={1}
          noiseAmp={1}
          chromaticAberration={0}
          dither={0}
          curvature={0.05}
          tint="#A7EF9E"
          mouseReact
          mouseStrength={0.5}
          cursorMask={EYE_CURSOR_MASK}
          brightness={0.3}
        />
      </div>

      {/* Landing content — fades out when game activates */}
      <div className="relative z-10 flex min-h-screen w-full flex-col md:max-w-[95vw]">
        <LandingHeader session={session} />
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
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
          <RetroComputer gameCanvas={gameActive ? gameCanvas : null} />
        </div>
      </div>
    </div>
  )
}
