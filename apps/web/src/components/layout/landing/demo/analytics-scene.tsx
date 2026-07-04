"use client"

import {
  ArrowLeftIcon,
  BanIcon,
  PackagePlusIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Area, AreaChart, Tooltip } from "#/components/dither-kit"
import { Delta, type Metric, StatCard } from "./chrome"
import { ANALYTICS_EVENTS, METRICS } from "./data"
import { listStagger, rowIn } from "./motion"
import { ACCENT, V } from "./theme"

const EVENT_ICONS = [
  TrendingUpIcon,
  TrendingDownIcon,
  BanIcon,
  SparklesIcon,
  PackagePlusIcon,
]

/**
 * modkit's analytics view: back link, the focused metric's big number (pinned
 * to wherever you click on the chart), the edge-masked dither chart, the
 * events feed (committed point pulls its nearest event to the top), and the
 * bottom metrics sheet that lifts the whole page when opened.
 */
export function AnalyticsScene({
  source,
  metricKey,
  onBack,
  onFocusMetric,
}: {
  source: "moderation" | "automod"
  metricKey: string
  onBack: () => void
  onFocusMetric: (key: string) => void
}) {
  const metrics = METRICS[source]
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]
  const [committed, setCommitted] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const len = metric.series.length
  const at = committed ?? len - 1
  const value = metric.series[at]
  const ago = (len - 1 - at) * 2 // 2h buckets, like the real seed
  const chartData = metric.series.map((v) => ({ v }))

  // committed point pulls the event closest to it to the top of the feed
  const focusedEvent =
    committed == null
      ? null
      : [...ANALYTICS_EVENTS].sort(
          (a, b) => Math.abs(a.at - committed) - Math.abs(b.at - committed)
        )[0]
  const events = focusedEvent
    ? [
        focusedEvent,
        ...ANALYTICS_EVENTS.filter((e) => e.id !== focusedEvent.id),
      ]
    : ANALYTICS_EVENTS

  return (
    <div className="flex h-full min-h-0 flex-col">
      <motion.div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 pt-3"
        variants={listStagger}
      >
        <motion.span
          variants={rowIn}
          onClick={onBack}
          className="flex w-fit items-center gap-1.5 text-[11px]"
          style={{ color: V.fg2 }}
        >
          <ArrowLeftIcon size={11} />
          Back to {source === "automod" ? "Automod" : "Moderation"}
        </motion.span>

        <motion.header variants={rowIn} className="flex flex-col gap-0.5">
          <span className="text-[12px]" style={{ color: V.fg2 }}>
            {metric.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-[30px] font-semibold"
              style={{ color: V.fg }}
            >
              {value}
              {metric.suffix ?? ""}
            </span>
            <Delta delta={metric.delta} invertDelta={metric.invertDelta} />
            <span
              className="font-mono text-[11px] tabular-nums"
              style={{ color: V.fg2 }}
            >
              {ago === 0 ? "now" : `−${ago}h`}
            </span>
          </div>
        </motion.header>

        {/* full-bleed chart, edge-masked like the real page; click to commit */}
        <motion.div
          variants={rowIn}
          className="relative -mx-2 h-36 shrink-0 cursor-crosshair overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, #000 2.25rem, #000 calc(100% - 2.25rem), transparent)",
          }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const t = (e.clientX - rect.left) / rect.width
            setCommitted(
              Math.max(0, Math.min(len - 1, Math.round(t * (len - 1))))
            )
          }}
        >
          <AreaChart
            data={chartData}
            config={{ v: { color: metric.color } }}
            bloom="aura"
            markerIndex={committed}
            margins={{ top: 24, right: 0, bottom: 12, left: 0 }}
            className="absolute inset-0"
          >
            <Area dataKey="v" variant="gradient" />
            <Tooltip
              valueFormatter={(val: number) => `${val}${metric.suffix ?? ""}`}
            />
          </AreaChart>
        </motion.div>

        {/* activity feed */}
        <motion.div
          variants={rowIn}
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden"
        >
          {events.map((e, i) => {
            const Icon = EVENT_ICONS[e.id.charCodeAt(1) % EVENT_ICONS.length]
            const focused = focusedEvent?.id === e.id
            return (
              <motion.div
                key={e.id}
                layout
                transition={{ type: "spring", stiffness: 480, damping: 42 }}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: focused ? V.muted : "transparent" }}
              >
                <Icon size={13} style={{ color: V.fg2 }} className="shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className="truncate text-[12px] font-medium"
                    style={{ color: V.fg }}
                  >
                    {e.title}
                  </span>
                  <span
                    className="truncate text-[11px]"
                    style={{ color: V.fg2 }}
                  >
                    {e.detail} · {e.ago}
                  </span>
                </div>
                {e.impact && (
                  <span
                    className="shrink-0 font-mono text-[10px] tabular-nums"
                    style={{
                      color: e.impact.good ? ACCENT.good : ACCENT.amber,
                    }}
                  >
                    {e.impact.label}
                  </span>
                )}
                {i >= 3 ? null : null}
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>

      {/* metrics sheet — the tab lifts the whole page height when opened */}
      <div className="relative z-10 flex shrink-0 flex-col items-center">
        <span
          onClick={() => setSheetOpen((o) => !o)}
          className="relative flex items-center gap-2 rounded-t-xl px-3 py-1.5"
          style={{ background: V.muted }}
        >
          <span className="text-[12px] font-semibold" style={{ color: V.fg }}>
            {sheetOpen ? "Close Metrics" : "Show Metrics"}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
            style={{ background: V.surface1, color: V.fg2 }}
          >
            {metrics.length}
          </span>
        </span>
      </div>
      <motion.div
        initial={false}
        animate={{ height: sheetOpen ? "auto" : 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        className="w-full shrink-0 overflow-hidden"
        style={{ background: V.muted }}
      >
        <AnimatePresence>
          <div className="grid grid-cols-4 gap-3 p-4">
            {metrics.map((m: Metric) => (
              <StatCard
                key={m.key}
                metric={m}
                compact
                focused={m.key === metric.key}
                onClick={() => {
                  onFocusMetric(m.key)
                  setCommitted(null)
                }}
              />
            ))}
          </div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
