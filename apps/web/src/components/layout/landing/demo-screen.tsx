"use client"

import {
  BarChart3Icon,
  CircleDotIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
  MoonIcon,
  SearchIcon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react"
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Area, AreaChart, Sparkline } from "#/components/dither-kit"

/**
 * The picture on the retro computer's CRT: a self-playing tour of modkit,
 * the moderation dashboard — cloned 1:1 from the real app. Chrome, pages,
 * copy, and palette all mirror the shipped frontend: the topbar with the
 * pixel wordmark and counted nav, the Queue page with its dither stat cards
 * and flagged-item rows, Automod's rule list with sparklines and switches,
 * and Analytics' focused-metric chart.
 *
 * A little cursor glides to a nav item, clicks it, and the page changes.
 * The visitor's own mouse takes over on hover; the tour resumes after 5s
 * of stillness. Rendered at 2× and scaled to 0.5 so type stays crisp on
 * the tube.
 */

/* ------------------------------------------------------------- palette */
// modkit's zinc dark theme, resolved from its oklch tokens.
const P = {
  bg: "#09090b", // --background
  card: "#18181b", // --card
  surface0: "#1f1f23", // --surface-0 (active nav)
  surface1: "#232327", // --surface-1 (inputs)
  surface2: "#2b2b30", // --surface-2 (reason pills)
  border: "#27272a", // --border
  text: "#fafafa", // --foreground
  text2: "#a1a1aa", // --muted-foreground
  good: "#10b981", // emerald-500 delta
  bad: "#ef4444", // red-500 delta
  amber: "#f59e0b", // severity high
  red: "#ef4444", // severity critical
} as const

/* ---------------------------------------------------------------- tour */

const SCENES = ["queue", "automod", "analytics"] as const
type Scene = (typeof SCENES)[number]

// Where the fake cursor rests / clicks, in the 2× render's pixel space.
// The nav items sit at fixed offsets, so no measuring is needed.
const NAV_X: Record<Scene, number> = {
  queue: 120,
  automod: 205,
  analytics: 310,
}
const NAV_Y = 24
const REST: Record<Scene, { x: number; y: number }> = {
  queue: { x: 430, y: 330 },
  automod: { x: 250, y: 300 },
  analytics: { x: 470, y: 280 },
}

const SCENE_MS = 4600 // time on each page
const CLICK_MS = 900 // cursor travel + press before the swap

/** Drives the loop: cursor heads for the next nav item, clicks, scene swaps.
 * Paused while the visitor's own mouse has the screen; `goTo` serves their
 * clicks. */
function useTour(reduceMotion: boolean, paused: boolean) {
  const [scene, setScene] = useState<Scene>("queue")
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

/** modkit's DitherStatCard: label, value + delta, chart flush at the foot. */
function StatCard({
  label,
  value,
  delta,
  invertDelta = false,
  color,
  series,
}: {
  label: string
  value: string
  delta: number
  invertDelta?: boolean
  color: "red" | "blue" | "purple" | "orange"
  series: number[]
}) {
  const good = invertDelta ? delta < 0 : delta > 0
  return (
    <div className="overflow-hidden rounded-xl" style={{ background: P.card }}>
      <div className="flex flex-col gap-1.5 px-3.5 pt-3.5 pb-2.5">
        <span className="text-[12px]" style={{ color: P.text2 }}>
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[22px]" style={{ color: P.text }}>
            {value}
          </span>
          <span
            className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums"
            style={{ color: good ? P.good : P.bad }}
          >
            <span className="text-[8px] leading-none">
              {delta > 0 ? "▲" : "▼"}
            </span>
            {Math.abs(delta)}
          </span>
        </div>
      </div>
      <div className="h-11">
        <Sparkline data={series} color={color} bloom="aura" animate />
      </div>
    </div>
  )
}

/** ReasonPill + SeverityBadge, straight from the app. */
function ReasonPill({ children }: { children: string }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium"
      style={{ background: P.surface2, color: P.text2 }}
    >
      {children}
    </span>
  )
}

function SeverityBadge({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: dot }} />
      <span className="text-[11px]" style={{ color: P.text2 }}>
        {label}
      </span>
    </span>
  )
}

/* --------------------------------------------------------------- scenes */

// Real rows from modkit's mock queue.
const QUEUE_ITEMS = [
  {
    icon: MessageSquareIcon,
    title: "buy cheap followers + crypto airdrop 🚀🚀 link in bio",
    meta: "facebook/react #31204 · 12m ago",
    reason: "Spam",
    severity: "Critical",
    dot: P.red,
  },
  {
    icon: GitPullRequestIcon,
    title: "Add 4000 lines of unrelated vendored code",
    meta: "biomejs/biome #4711 · 38m ago",
    reason: "Spam",
    severity: "High",
    dot: P.amber,
  },
  {
    icon: MessageSquareIcon,
    title: "Automod: matched blocklist pattern in comment",
    meta: "honojs/hono #2988 · 1h ago",
    reason: "Automod",
    severity: "Medium",
    dot: "rgba(161,161,170,0.6)",
  },
  {
    icon: CircleDotIcon,
    title: "+1 +1 +1 please merge this is urgent for my job interview",
    meta: "drizzle-team/drizzle-orm #3350 · 2h ago",
    reason: "Off-topic",
    severity: "Low",
    dot: "rgba(161,161,170,0.3)",
  },
]

function QueueScene() {
  return (
    <motion.div
      className="flex flex-col gap-4 px-5 pt-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn} className="flex flex-col gap-1">
        <span className="text-[20px] font-semibold" style={{ color: P.text }}>
          Moderation
        </span>
        <span className="text-[12px]" style={{ color: P.text2 }}>
          Triage flagged issues, pull requests, and comments across your
          organization.
        </span>
      </motion.div>

      {/* the four dither stat cards */}
      <motion.div variants={rowIn} className="grid grid-cols-4 gap-3">
        <StatCard
          label="Pending"
          value="14"
          delta={3}
          invertDelta
          color="red"
          series={[4, 6, 5, 9, 7, 11, 8, 12, 10, 14]}
        />
        <StatCard
          label="Resolved today"
          value="38"
          delta={12}
          color="blue"
          series={[8, 10, 9, 12, 14, 13, 16, 15, 18, 21]}
        />
        <StatCard
          label="Automod · 24h"
          value="112"
          delta={-9}
          invertDelta
          color="purple"
          series={[12, 9, 11, 8, 10, 7, 9, 6, 8, 5]}
        />
        <StatCard
          label="Banned"
          value="6"
          delta={2}
          color="orange"
          series={[2, 3, 2, 4, 3, 5, 4, 4, 6, 5]}
        />
      </motion.div>

      {/* pending / log toggle + queue rows */}
      <motion.div variants={rowIn} className="flex items-center gap-0.5">
        <span
          className="flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11px] font-medium"
          style={{ background: P.card, color: P.text }}
        >
          Pending
          <span className="tabular-nums" style={{ color: P.text2 }}>
            14
          </span>
        </span>
        <span
          className="rounded-[5px] px-2.5 py-1 text-[11px] font-medium"
          style={{ color: P.text2 }}
        >
          Log
        </span>
      </motion.div>

      <motion.div variants={rowIn} className="flex flex-col gap-1">
        {QUEUE_ITEMS.map((q) => (
          <div
            key={q.title}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
          >
            <q.icon
              size={13}
              style={{ color: P.text2 }}
              className="shrink-0 self-start"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className="truncate text-[12px] font-medium"
                style={{ color: P.text }}
              >
                {q.title}
              </span>
              <span className="truncate text-[11px]" style={{ color: P.text2 }}>
                {q.meta}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ReasonPill>{q.reason}</ReasonPill>
              <SeverityBadge label={q.severity} dot={q.dot} />
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

// Real rules from modkit's automod mocks.
const RULES = [
  {
    name: "Known spam domains",
    desc: "Blocks links to a maintained blocklist of spam domains",
    hits: 41,
    series: [3, 5, 4, 7, 6, 9, 8, 11],
    on: true,
  },
  {
    name: "New-account burst",
    desc: "Flags accounts under 7 days old posting in bursts",
    hits: 23,
    series: [2, 4, 3, 6, 5, 7, 6, 8],
    on: true,
  },
  {
    name: "Crypto & airdrop promos",
    desc: "Catches token-drop and wallet-drainer promotions",
    hits: 17,
    series: [5, 4, 6, 3, 5, 4, 6, 5],
    on: true,
  },
  {
    name: "Harassment & threats",
    desc: "Classifier for hostile or threatening language",
    hits: 4,
    series: [1, 2, 1, 3, 2, 2, 1, 2],
    on: false,
  },
]

function AutomodScene() {
  return (
    <motion.div
      className="flex flex-col gap-4 px-5 pt-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn} className="flex flex-col gap-1">
        <span className="text-[20px] font-semibold" style={{ color: P.text }}>
          Automod
        </span>
        <span className="text-[12px]" style={{ color: P.text2 }}>
          Rules that run on every webhook so you don't have to.
        </span>
      </motion.div>

      <motion.div variants={rowIn} className="flex flex-col gap-1">
        {RULES.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
          >
            <ShieldIcon
              size={13}
              style={{ color: P.text2 }}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className="truncate text-[12px] font-medium"
                style={{ color: P.text }}
              >
                {r.name}
              </span>
              <span className="truncate text-[11px]" style={{ color: P.text2 }}>
                {r.desc}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-5">
              <div className="h-7 w-20">
                <Sparkline
                  data={r.series}
                  color={r.on ? "green" : "grey"}
                  animate
                />
              </div>
              <div className="w-10 text-right">
                <p
                  className="text-[12px] leading-none font-medium tabular-nums"
                  style={{ color: P.text }}
                >
                  {r.hits}
                </p>
                <p className="mt-1 text-[10px]" style={{ color: P.text2 }}>
                  24h
                </p>
              </div>
              {/* the shadcn switch, miniaturized */}
              <span
                className="flex h-4 w-7 items-center rounded-full px-0.5"
                style={{
                  background: r.on ? P.text : P.surface2,
                  justifyContent: r.on ? "flex-end" : "flex-start",
                }}
              >
                <span
                  className="size-3 rounded-full"
                  style={{ background: r.on ? P.bg : P.text2 }}
                />
              </span>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

const ANALYTICS_SERIES = [
  { v: 6 },
  { v: 9 },
  { v: 7 },
  { v: 12 },
  { v: 10 },
  { v: 15 },
  { v: 13 },
  { v: 18 },
  { v: 14 },
  { v: 19 },
  { v: 16 },
  { v: 22 },
]

function AnalyticsScene() {
  return (
    <motion.div
      className="flex h-full flex-col gap-3 px-5 pt-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn} className="flex flex-col gap-1">
        <span className="text-[12px]" style={{ color: P.text2 }}>
          Pending reports
        </span>
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-[30px] font-semibold"
            style={{ color: P.text }}
          >
            14
          </span>
          <span
            className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums"
            style={{ color: P.bad }}
          >
            <span className="text-[8px] leading-none">▲</span>3
          </span>
          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: P.text2 }}
          >
            last 30 days
          </span>
        </div>
      </motion.div>

      {/* the focused-metric dither chart, full bleed like the real page */}
      <motion.div variants={rowIn} className="relative h-44">
        <AreaChart
          data={ANALYTICS_SERIES}
          config={{ v: { color: "red" } }}
          bloom="aura"
          interactive={false}
          margins={{ top: 20, right: 0, bottom: 12, left: 0 }}
          className="absolute inset-0"
        >
          <Area dataKey="v" variant="gradient" />
        </AreaChart>
      </motion.div>

      <motion.div variants={rowIn} className="grid grid-cols-3 gap-3">
        {(
          [
            {
              label: "Resolved",
              value: "38",
              color: "blue",
              series: [4, 6, 8, 7, 10, 12, 11, 14],
            },
            {
              label: "Automod hits",
              value: "112",
              color: "purple",
              series: [9, 7, 8, 6, 7, 5, 6, 4],
            },
            {
              label: "Banned",
              value: "6",
              color: "orange",
              series: [1, 2, 2, 3, 2, 4, 3, 5],
            },
          ] as const
        ).map((m) => (
          <div
            key={m.label}
            className="overflow-hidden rounded-xl"
            style={{ background: P.card }}
          >
            <div className="flex flex-col gap-0.5 px-3 pt-2.5 pb-1.5">
              <span className="text-[11px]" style={{ color: P.text2 }}>
                {m.label}
              </span>
              <span className="text-[16px]" style={{ color: P.text }}>
                {m.value}
              </span>
            </div>
            <div className="h-8">
              <Sparkline data={[...m.series]} color={m.color} animate />
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

/* ----------------------------------------------------------------- nav */

const NAV_ITEMS: {
  scene: Scene
  label: string
  icon: typeof ShieldIcon
  count?: number
}[] = [
  { scene: "queue", label: "Queue", icon: CircleDotIcon, count: 14 },
  { scene: "automod", label: "Automod", icon: ShieldIcon, count: 5 },
  { scene: "analytics", label: "Analytics", icon: BarChart3Icon },
]

function TopNav({
  active,
  onNavigate,
}: {
  active: Scene
  onNavigate: (s: Scene) => void
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      style={{ borderBottom: `1px solid ${P.border}` }}
    >
      <span
        className="px-1 text-[13px] font-medium"
        style={{ color: P.text, fontFamily: '"Geist Pixel", monospace' }}
      >
        modkit
      </span>
      <div className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => (
          <span
            key={item.scene}
            onClick={() => onNavigate(item.scene)}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium"
            style={
              item.scene === active
                ? { background: P.surface0, color: P.text }
                : { color: P.text2 }
            }
          >
            <item.icon size={12} />
            {item.label}
            {typeof item.count === "number" && (
              <span className="tabular-nums" style={{ color: P.text2 }}>
                {item.count}
              </span>
            )}
          </span>
        ))}
        <span
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium"
          style={{ color: P.text2 }}
        >
          <WrenchIcon size={12} />
          Integrations
        </span>
      </div>
      {/* search + chrome, right side */}
      <div
        className="ml-auto flex h-7 w-40 items-center gap-2 rounded-md px-2.5"
        style={{ background: P.surface1 }}
      >
        <SearchIcon size={11} style={{ color: P.text2 }} />
        <span className="text-[11px]" style={{ color: P.text2 }}>
          Search reports…
        </span>
      </div>
      <MoonIcon size={13} style={{ color: P.text2 }} />
      <span
        className="size-6 rounded-full"
        style={{
          border: `1px solid ${P.border}`,
          background: "linear-gradient(135deg, #6d28d9, #1e293b)",
        }}
      />
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
  const x = useMotionValue(REST.queue.x)
  const y = useMotionValue(REST.queue.y)

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
  queue: () => <QueueScene />,
  automod: () => <AutomodScene />,
  analytics: () => <AnalyticsScene />,
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
