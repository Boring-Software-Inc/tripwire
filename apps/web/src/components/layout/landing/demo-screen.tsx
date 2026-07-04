"use client"

import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { AnalyticsScene } from "./demo/analytics-scene"
import { AutomodScene } from "./demo/automod-scene"
import {
  type DemoPage,
  type DemoRoute,
  type Metric,
  TopNav,
} from "./demo/chrome"
import { QUEUE_ITEMS, type QueueItem, RULES, type Rule } from "./demo/data"
import { IntegrationsScene } from "./demo/integrations-scene"
import { QueueScene } from "./demo/queue-scene"
import { ModerationDetail, PanelGrid, RuleDetail } from "./demo/side-panel"
import { type DemoTheme, themeVars } from "./demo/theme"

/**
 * The picture on the retro computer's CRT: a working miniature of modkit.
 * Four real pages (queue, automod, analytics, integrations) with the app's
 * actual interactions — sort toggles, filter chips, the sliding detail
 * panel, chart-commit clicks, the metrics sheet, pagination, and a theme
 * toggle scoped to the glass.
 *
 * A tour cursor walks the nav on its own; the visitor's mouse takes over on
 * hover and control lingers until 5s of stillness. Rendered at 2× and scaled
 * to 0.5 so type stays crisp on the tube.
 */

/* ---------------------------------------------------------------- tour */

const TOUR_PAGES: DemoPage[] = ["queue", "automod", "analytics", "integrations"]

// Cursor waypoints in the 2× render's pixel space.
const NAV_X: Record<DemoPage, number> = {
  queue: 120,
  automod: 208,
  analytics: 316,
  integrations: 430,
}
const NAV_Y = 24
const REST: Record<DemoPage, { x: number; y: number }> = {
  queue: { x: 430, y: 330 },
  automod: { x: 250, y: 310 },
  analytics: { x: 470, y: 270 },
  integrations: { x: 380, y: 320 },
}

const SCENE_MS = 4600
const CLICK_MS = 900

function routeFor(page: DemoPage): DemoRoute {
  return page === "analytics"
    ? { page, source: "moderation", metric: "pending" }
    : ({ page } as DemoRoute)
}

function useTour(reduceMotion: boolean, paused: boolean) {
  const [route, setRoute] = useState<DemoRoute>({ page: "queue" })
  const [phase, setPhase] = useState<"resting" | "clicking">("resting")

  const goTo = (r: DemoRoute) => {
    setRoute(r)
    setPhase("resting")
  }

  useEffect(() => {
    if (paused) return
    const advance = () =>
      setRoute((r) => {
        const i = TOUR_PAGES.indexOf(r.page)
        return routeFor(TOUR_PAGES[(i + 1) % TOUR_PAGES.length])
      })
    if (reduceMotion) {
      const t = setInterval(advance, SCENE_MS)
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
        advance()
        rest()
      }, CLICK_MS)
    }
    rest()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reduceMotion, paused])

  const next =
    TOUR_PAGES[(TOUR_PAGES.indexOf(route.page) + 1) % TOUR_PAGES.length]
  return { route, phase, next, goTo }
}

/* --------------------------------------------------------------- cursor */

function useDemoCursor(
  phase: string,
  next: DemoPage,
  page: DemoPage,
  interactive: boolean
) {
  const x = useMotionValue(REST.queue.x)
  const y = useMotionValue(REST.queue.y)

  useEffect(() => {
    if (interactive) return
    const target =
      phase === "clicking" ? { x: NAV_X[next], y: NAV_Y } : REST[page]
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
  }, [interactive, phase, next, page, x, y])

  return { x, y }
}

function TourCursor({
  x,
  y,
  dip,
}: {
  x: ReturnType<typeof useMotionValue<number>>
  y: ReturnType<typeof useMotionValue<number>>
  dip: "tour" | "press" | null
}) {
  return (
    <motion.div
      className="pointer-events-none absolute z-30"
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

/* ---------------------------------------------------------------- screen */

type PanelState =
  | { kind: "item"; id: string }
  | { kind: "rule"; id: string }
  | null

export function DemoScreen({
  onEngagement,
}: {
  /** Fires when the visitor's mouse takes / releases the screen. */
  onEngagement?: (engaged: boolean) => void
}) {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    setReduceMotion(
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    )
  }, [])

  // -- takeover: the tour runs until the visitor's mouse claims the screen
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

  useEffect(() => {
    onEngagement?.(interactive)
  }, [interactive, onEngagement])

  const { route, phase, next, goTo } = useTour(reduceMotion, interactive)
  const cursor = useDemoCursor(phase, next, route.page, interactive)

  // -- app state: theme, queue items, rules, open panel
  const [theme, setTheme] = useState<DemoTheme>("dark")
  const [items, setItems] = useState<QueueItem[]>(QUEUE_ITEMS)
  const [rules, setRules] = useState<Rule[]>(RULES)
  const [panel, setPanel] = useState<PanelState>(null)

  const navigate = (page: DemoPage) => {
    setPanel(null) // real navigation drops the detail view too
    goTo(routeFor(page))
  }
  const openMetric = (source: "moderation" | "automod", metric: Metric) => {
    setPanel(null)
    goTo({ page: "analytics", source, metric: metric.key })
  }
  const toggleRule = (rule: Rule) =>
    setRules((rs) =>
      rs.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    )

  const panelItem =
    panel?.kind === "item" ? items.find((i) => i.id === panel.id) : undefined
  const panelRule =
    panel?.kind === "rule" ? rules.find((r) => r.id === panel.id) : undefined

  const onPointerMove = (e: React.PointerEvent) => {
    touch()
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    cursor.x.set((e.clientX - rect.left) / 0.6)
    cursor.y.set((e.clientY - rect.top) / 0.6)
  }

  const scene = (() => {
    switch (route.page) {
      case "queue":
        return (
          <QueueScene
            items={items}
            activeItemId={panel?.kind === "item" ? panel.id : null}
            onOpenItem={(item) =>
              setPanel((p) =>
                p?.kind === "item" && p.id === item.id
                  ? null
                  : { kind: "item", id: item.id }
              )
            }
            onOpenMetric={(m) => openMetric("moderation", m)}
          />
        )
      case "automod":
        return (
          <AutomodScene
            rules={rules}
            activeRuleId={panel?.kind === "rule" ? panel.id : null}
            onOpenRule={(rule) =>
              setPanel((p) =>
                p?.kind === "rule" && p.id === rule.id
                  ? null
                  : { kind: "rule", id: rule.id }
              )
            }
            onToggleRule={toggleRule}
            onOpenMetric={(m) => openMetric("automod", m)}
          />
        )
      case "analytics":
        return (
          <AnalyticsScene
            source={route.source}
            metricKey={route.metric}
            onBack={() =>
              navigate(route.source === "automod" ? "automod" : "queue")
            }
            onFocusMetric={(key) =>
              goTo({ page: "analytics", source: route.source, metric: key })
            }
          />
        )
      case "integrations":
        return <IntegrationsScene />
    }
  })()

  return (
    <div
      ref={rootRef}
      className="h-full w-full overflow-hidden"
      style={{
        ...themeVars(theme),
        background: "var(--d-bg)",
        cursor: "none",
      }}
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
        style={{
          width: "166.667%",
          height: "166.667%",
          transform: "scale(0.6)",
        }}
      >
        <TopNav
          active={route.page}
          theme={theme}
          onNavigate={(page) => interactive && navigate(page)}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
        />

        <PanelGrid
          open={panel !== null}
          main={
            <AnimatePresence mode="wait">
              <motion.div
                key={route.page}
                className="h-full min-h-0 overflow-hidden"
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
                {scene}
              </motion.div>
            </AnimatePresence>
          }
          panel={
            panelItem ? (
              <ModerationDetail
                item={panelItem}
                onClose={() => setPanel(null)}
                onResolve={() => {
                  setItems((list) => list.filter((i) => i.id !== panelItem.id))
                  setPanel(null)
                }}
              />
            ) : panelRule ? (
              <RuleDetail
                rule={panelRule}
                onClose={() => setPanel(null)}
                onToggle={() => toggleRule(panelRule)}
              />
            ) : null
          }
        />

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
