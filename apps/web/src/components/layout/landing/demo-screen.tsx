"use client"

import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Sparkline } from "#/components/dither-kit"

/**
 * The picture on the retro computer's CRT: a self-playing tour of the real
 * product. A little cursor glides to a nav item, clicks it, and the page
 * changes — charts run their dither entrances, lists stagger in — looping
 * home → insights → events, exactly the chrome and palette of the shipped app.
 *
 * Rendered at 2× and scaled to 0.5 so type and hairlines stay crisp on the
 * tube.
 */

/* ------------------------------------------------------------- palette */
// The real app's tw-* tokens, hardcoded so the miniature never drifts.
const P = {
  bg: "#0d0d0f",
  surface: "#17171a",
  card: "#202023",
  border: "#27272a",
  text: "#eeeeee",
  text2: "#b4b4b4",
  muted: "#9f9fa9",
  faint: "#6e6e6e",
  success: "#67e19f",
  warning: "#d1bc00",
  error: "#f56d5d",
} as const

/* ---------------------------------------------------------------- tour */

const SCENES = ["home", "insights", "events"] as const
type Scene = (typeof SCENES)[number]

// Where the fake cursor rests / clicks, in the 2× render's pixel space.
// The nav items sit at fixed offsets, so no measuring is needed.
const NAV_X: Record<Scene, number> = { home: 96, insights: 236, events: 320 }
const NAV_Y = 22
const REST: Record<Scene, { x: number; y: number }> = {
  home: { x: 430, y: 300 },
  insights: { x: 210, y: 330 },
  events: { x: 470, y: 260 },
}

const SCENE_MS = 4600 // time on each page
const CLICK_MS = 900 // cursor travel + press before the swap

/** Drives the loop: cursor heads for the next nav item, clicks, scene swaps.
 * Paused while the visitor's own mouse has the screen; `goTo` serves their
 * clicks. */
function useTour(reduceMotion: boolean, paused: boolean) {
  const [scene, setScene] = useState<Scene>("home")
  const [phase, setPhase] = useState<"resting" | "clicking">("resting")
  const goTo = (s: Scene) => {
    setScene(s)
    setPhase("resting")
  }

  useEffect(() => {
    if (paused) return
    if (reduceMotion) {
      // No cursor theatrics — just rotate the pages.
      const t = setInterval(() => {
        setScene((s) => SCENES[(SCENES.indexOf(s) + 1) % SCENES.length])
      }, SCENE_MS)
      return () => clearInterval(t)
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const rest = () => {
      setPhase("resting")
      timer = setTimeout(click, SCENE_MS - CLICK_MS)
    }
    const click = () => {
      if (cancelled) return
      setPhase("clicking")
      timer = setTimeout(() => {
        if (cancelled) return
        setScene((s) => SCENES[(SCENES.indexOf(s) + 1) % SCENES.length])
        rest()
      }, CLICK_MS)
    }
    rest()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reduceMotion, paused])

  const next = SCENES[(SCENES.indexOf(scene) + 1) % SCENES.length]
  return { scene, phase, next, goTo }
}

/* ------------------------------------------------------------ fragments */

function Avatar({ hue, size = 18 }: { hue: number; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 45% 55%), hsl(${hue + 40} 45% 35%))`,
      }}
    />
  )
}

function Chip({
  children,
  tone = P.card,
}: {
  children: string
  tone?: string
}) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[10px]"
      style={{
        background: tone,
        color: P.text2,
        border: `1px solid ${P.border}`,
      }}
    >
      {children}
    </span>
  )
}

// Content springs in row by row, like a page that just loaded.
const listStagger = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
}
const rowIn = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", visualDuration: 0.4, bounce: 0.1 },
  },
} as const

/* --------------------------------------------------------------- scenes */

const HOME_EVENTS = [
  {
    hue: 210,
    title: "3 spam PRs blocked on tripwire/api",
    action: "review",
    dot: P.error,
  },
  {
    hue: 20,
    title: "New contributor flagged — first PR, 4k lines",
    action: "review",
    dot: P.warning,
  },
  {
    hue: 140,
    title: "Nightly sweep finished clean",
    action: "view",
    dot: P.success,
  },
]

function HomeScene() {
  return (
    <motion.div
      className="flex flex-col gap-3 px-5 pt-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn} className="flex flex-col gap-0.5">
        <span
          className="font-sans text-[19px] font-medium"
          style={{ color: P.text }}
        >
          Welcome back, grim
        </span>
        <span className="text-[11px]" style={{ color: P.muted }}>
          7 events need your attention
        </span>
      </motion.div>
      {HOME_EVENTS.map((e) => (
        <motion.div
          key={e.title}
          variants={rowIn}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
          style={{ background: P.surface, border: `1px solid ${P.border}` }}
        >
          <Avatar hue={e.hue} />
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: e.dot }}
          />
          <span className="truncate text-[12px]" style={{ color: P.text2 }}>
            {e.title}
          </span>
          <span
            className="ml-auto shrink-0 rounded px-2 py-0.5 text-[11px]"
            style={{ background: "#363639", color: P.text }}
          >
            {e.action}
          </span>
        </motion.div>
      ))}
    </motion.div>
  )
}

const INSIGHT_STATS = [
  { label: "spam PRs", value: "812", trend: "-31%" },
  { label: "bot accounts", value: "94", trend: "-12%" },
  { label: "ai slop", value: "356", trend: "-24%" },
  { label: "near misses", value: "41", trend: "+6%" },
]

function InsightsScene() {
  return (
    <motion.div
      className="flex flex-col gap-3 px-5 pt-4"
      variants={listStagger}
    >
      {/* hero stat */}
      <motion.div
        variants={rowIn}
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: P.surface, border: `1px solid ${P.border}` }}
      >
        <div className="flex flex-col">
          <span className="text-[11px]" style={{ color: P.muted }}>
            slop prevented
          </span>
          <span
            className="font-sans text-[26px] font-medium"
            style={{ color: P.text }}
          >
            1,203
          </span>
        </div>
        <div className="h-10 w-40">
          <Sparkline
            data={[3, 5, 4, 7, 9, 8, 12, 11, 14, 17]}
            color="green"
            animate
          />
        </div>
      </motion.div>
      {/* stat row with borders-between, like the real StatCard strip */}
      <motion.div
        variants={rowIn}
        className="flex rounded-lg"
        style={{ background: P.surface, border: `1px solid ${P.border}` }}
      >
        {INSIGHT_STATS.map((s, i) => (
          <div
            key={s.label}
            className="flex flex-1 flex-col gap-0.5 px-3 py-2.5"
            style={i > 0 ? { borderLeft: `1px solid ${P.border}` } : undefined}
          >
            <span className="text-[10px]" style={{ color: P.muted }}>
              {s.label}
            </span>
            <span className="text-[15px]" style={{ color: "#ffffffcc" }}>
              {s.value}
            </span>
            <span
              className="font-mono text-[10px]"
              style={{ color: s.trend.startsWith("-") ? P.success : P.warning }}
            >
              {s.trend}
            </span>
          </div>
        ))}
      </motion.div>
      {/* trend charts — dither entrances run on every visit */}
      <motion.div variants={rowIn} className="grid grid-cols-2 gap-3">
        {(
          [
            {
              label: "total bots",
              color: "blue",
              data: [2, 4, 3, 6, 5, 9, 8, 11, 10, 13],
            },
            {
              label: "spam trend",
              color: "red",
              data: [9, 7, 8, 6, 7, 5, 4, 5, 3, 2],
            },
          ] as const
        ).map((c) => (
          <div
            key={c.label}
            className="flex flex-col gap-1 rounded-lg px-3 py-2.5"
            style={{ background: P.surface, border: `1px solid ${P.border}` }}
          >
            <span className="text-[10px]" style={{ color: P.muted }}>
              {c.label}
            </span>
            <div className="h-12">
              <Sparkline data={[...c.data]} color={c.color} animate />
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

const EVENT_ROWS = [
  {
    kind: "pr",
    title: "Add comprehensive test coverage",
    rule: "spam",
    user: "dep-bot-991",
    time: "2m",
  },
  {
    kind: "pr",
    title: "Update dependencies to latest",
    rule: "ai slop",
    user: "helpful-dev",
    time: "11m",
  },
  {
    kind: "issue",
    title: "Fix typo in README.md",
    rule: "low effort",
    user: "typo-farmer",
    time: "26m",
  },
  {
    kind: "pr",
    title: "Refactor utils for better DX",
    rule: "ai slop",
    user: "helpful-dev",
    time: "1h",
  },
]

function EventsScene() {
  return (
    <motion.div
      className="flex flex-col gap-3 px-5 pt-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn} className="flex items-center gap-1.5">
        {["all", "blocked", "allowed", "near misses"].map((tab, i) => (
          <span
            key={tab}
            className="rounded-md px-2 py-1 text-[11px]"
            style={
              i === 0
                ? { background: "rgba(255,255,255,0.1)", color: P.text }
                : { color: "rgba(255,255,255,0.35)" }
            }
          >
            {tab}
          </span>
        ))}
      </motion.div>
      <motion.div
        variants={rowIn}
        className="flex flex-col gap-1 rounded-xl p-1.5"
        style={{ background: P.card }}
      >
        {EVENT_ROWS.map((e) => (
          <div
            key={e.title}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            style={{ background: P.bg }}
          >
            <Chip>{e.kind}</Chip>
            <span className="truncate text-[12px]" style={{ color: P.text2 }}>
              {e.title}
            </span>
            <Chip tone="#2c2440">{e.rule}</Chip>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <Avatar hue={(e.user.length * 47) % 360} size={12} />
              <span className="text-[10px]" style={{ color: P.faint }}>
                {e.user}
              </span>
              <span
                className="font-mono text-[10px]"
                style={{ color: P.faint }}
              >
                {e.time}
              </span>
            </span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

/* ----------------------------------------------------------------- nav */

function TopNav({
  active,
  onNavigate,
}: {
  active: Scene
  onNavigate: (s: Scene) => void
}) {
  return (
    <div
      className="flex items-center gap-1 px-4 py-2"
      style={{ borderBottom: `1px solid ${P.border}` }}
    >
      <Avatar hue={265} size={16} />
      {SCENES.map((item) => (
        <span
          key={item}
          onClick={() => onNavigate(item)}
          className="rounded-md px-2 py-1 text-[11px]"
          style={
            item === active
              ? { background: P.card, color: P.text }
              : { color: P.muted }
          }
        >
          {item}
        </span>
      ))}
      <span className="ml-auto flex items-center gap-2">
        <span className="text-[10px]" style={{ color: P.faint }}>
          tripwire / api
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[10px]"
          style={{ background: P.card, color: P.text2 }}
        >
          ask
        </span>
      </span>
    </div>
  )
}

/** The demo's pointer — glides on rails during the tour, and becomes the
 * visitor's actual cursor the moment their mouse takes the screen. */
function useDemoCursor(
  phase: string,
  next: Scene,
  scene: Scene,
  interactive: boolean
) {
  const x = useMotionValue(REST.home.x)
  const y = useMotionValue(REST.home.y)

  useEffect(() => {
    if (interactive) return // the mouse writes the values directly
    const target =
      phase === "clicking" ? { x: NAV_X[next], y: NAV_Y } : REST[scene]
    const spring = {
      type: "spring",
      visualDuration: 0.7,
      bounce: 0.05,
    } as const
    const ax = animate(x, target.x, spring)
    const ay = animate(y, target.y, spring)
    return () => {
      ax.stop()
      ay.stop()
    }
  }, [interactive, phase, next, scene, x, y])

  return { x, y }
}

function TourCursor({
  x,
  y,
  dip,
}: {
  x: ReturnType<typeof useMotionValue<number>>
  y: ReturnType<typeof useMotionValue<number>>
  /** "tour" plays the choreographed travel-then-click; "press" tracks a real
   * mouse button; null is at rest. */
  dip: "tour" | "press" | null
}) {
  return (
    <motion.div
      className="pointer-events-none absolute z-10"
      style={{ x, y }}
      animate={{
        scale: dip === "tour" ? [1, 1, 0.8, 1] : dip === "press" ? 0.82 : 1,
      }}
      transition={{
        scale:
          dip === "tour"
            ? { duration: CLICK_MS / 1000, times: [0, 0.75, 0.85, 1] }
            : { duration: 0.1 },
      }}
    >
      {/* classic pointer, drawn with borders — crisp at any scale */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "7px solid #ffffff",
          borderRight: "5px solid transparent",
          borderBottom: "12px solid transparent",
          borderTop: "2px solid #ffffff",
          filter: "drop-shadow(1px 1px 0 rgba(0,0,0,0.6))",
        }}
      />
    </motion.div>
  )
}

const SCENE_VIEW: Record<Scene, () => React.ReactNode> = {
  home: () => <HomeScene />,
  insights: () => <InsightsScene />,
  events: () => <EventsScene />,
}

/* ---------------------------------------------------------------- screen */

export function DemoScreen() {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    setReduceMotion(
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    )
  }, [])

  // The tour runs itself until the visitor's mouse takes the screen. Control
  // is held for as long as they keep interacting; after 5s of stillness (or
  // after leaving) the tour resumes — springing off from wherever the cursor
  // was left, since the same motion values carry both modes.
  const [interactive, setInteractive] = useState(false)
  const [pressed, setPressed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touch = () => {
    setInteractive(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setInteractive(false), 5000)
  }
  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    },
    []
  )
  const { scene, phase, next, goTo } = useTour(reduceMotion, interactive)
  const cursor = useDemoCursor(phase, next, scene, interactive)

  // Map the real pointer into the demo's 2× coordinate space.
  const onPointerMove = (e: React.PointerEvent) => {
    touch()
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    cursor.x.set((e.clientX - rect.left) * 2)
    cursor.y.set((e.clientY - rect.top) * 2)
  }

  return (
    <div
      ref={rootRef}
      className="h-full w-full overflow-hidden"
      style={{ background: P.bg, cursor: "none" }}
      onPointerEnter={touch}
      onPointerLeave={() => setPressed(false)}
      onPointerMove={onPointerMove}
      onPointerDown={() => {
        touch()
        setPressed(true)
      }}
      onPointerUp={() => setPressed(false)}
    >
      <div
        className="relative flex origin-top-left flex-col"
        style={{ width: "200%", height: "200%", transform: "scale(0.5)" }}
      >
        <TopNav active={scene} onNavigate={(s) => interactive && goTo(s)} />

        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            className="flex-1"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { staggerChildren: 0.07 },
            }}
            exit={{
              opacity: 0,
              y: reduceMotion ? 0 : -8,
              transition: { duration: 0.15 },
            }}
          >
            {SCENE_VIEW[scene]()}
          </motion.div>
        </AnimatePresence>

        {/* status line — pinned to the tube's bottom edge */}
        <div
          className="mt-auto flex items-center justify-between px-4 py-1.5"
          style={{ borderTop: `1px solid ${P.border}` }}
        >
          <span className="font-mono text-[10px]" style={{ color: P.faint }}>
            5 rules active
          </span>
          <span className="font-mono text-[10px]" style={{ color: P.success }}>
            webhooks connected
          </span>
        </div>

        {!reduceMotion && (
          <TourCursor
            x={cursor.x}
            y={cursor.y}
            dip={
              interactive
                ? pressed
                  ? "press"
                  : null
                : phase === "clicking"
                  ? "tour"
                  : null
            }
          />
        )}
      </div>

      {/* scanlines — plain lines, not a glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </div>
  )
}
