import { createFileRoute, Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { useEffect, useState, useCallback } from "react"
import { buildSeo } from "#/lib/seo"
import { authClient } from "@tripwire/auth/client"
import { LandingHeader } from "#/components/layout/landing/header"
import { useSpaceInvaders } from "#/components/layout/landing/space-invaders"
import { CloudEye } from "#/components/layout/landing/cloud-eye"
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
  const [powered, setPowered] = useState(false)
  const [gameActive, setGameActive] = useState(false)

  const exitGame = useCallback(() => setGameActive(false), [])
  const togglePower = useCallback(() => {
    setPowered((on) => {
      if (on) setGameActive(false) // powering off takes the game with it
      return !on
    })
  }, [])

  // The game boots straight onto the retro computer's CRT, replacing the
  // dashboard demo — but only once the machine is switched on.
  const gameCanvas = useSpaceInvaders(gameActive, exitGame)

  useEffect(() => {
    if (!powered || gameActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow")) setGameActive(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [powered, gameActive])

  return (
    // The stock desktop wallpaper, teal underneath while it loads.
    <div
      className="relative h-screen w-full overflow-hidden antialiased [font-synthesis:none]"
      style={{
        backgroundColor: "#008080",
        backgroundImage: "url(/wallpapers/win98.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* The eye, as a cloud in the sky, riding the cursor */}
      <div className="pointer-events-none absolute inset-0 z-[5] hidden md:block">
        <CloudEye />
      </div>

      {/* Hero — dead centre, above the machine */}
      <div className="relative z-10 flex h-full w-full flex-col">
        <LandingHeader session={session} />
        {/* fades away while the machine is running — it has the stage */}
        <motion.div
          className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4"
          animate={{ opacity: powered ? 0 : 1, y: powered ? -12 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ pointerEvents: powered ? "none" : "auto" }}
        >
          <h1 className="font-sans text-lg font-medium text-black/85">
            catch slop before it catches up with you
          </h1>
          {session ? (
            <Link
              to="/home"
              className="flex h-7 items-center rounded-lg bg-black px-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black/85"
            >
              get started
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex h-7 items-center rounded-lg bg-black px-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black/85"
            >
              login
            </Link>
          )}
        </motion.div>
      </div>

      {/* The machine waits at the bottom edge; its power button does the rest */}
      <div className="absolute inset-x-0 bottom-0 z-20 hidden justify-center px-4 md:flex">
        <RetroComputer
          powered={powered}
          onPowerToggle={togglePower}
          gameCanvas={gameActive ? gameCanvas : null}
        />
      </div>
    </div>
  )
}
