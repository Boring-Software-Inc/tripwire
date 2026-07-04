"use client"

import {
  BarChart3Icon,
  CircleDotIcon,
  MoonIcon,
  SearchIcon,
  ShieldIcon,
  SunIcon,
  WrenchIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { Sparkline } from "#/components/dither-kit"
import { ACCENT, type DemoTheme, V } from "./theme"

/** The demo's route space — a miniature of modkit's router. */
export type DemoRoute =
  | { page: "queue" }
  | { page: "automod" }
  | { page: "integrations" }
  | {
      page: "analytics"
      source: "moderation" | "automod"
      metric: string
    }

export type DemoPage = DemoRoute["page"]

/* ------------------------------------------------------------------ nav */

export const NAV_ITEMS: {
  page: DemoPage
  label: string
  icon: typeof ShieldIcon
  count?: number
}[] = [
  { page: "queue", label: "Queue", icon: CircleDotIcon, count: 6 },
  { page: "automod", label: "Automod", icon: ShieldIcon, count: 5 },
  { page: "analytics", label: "Analytics", icon: BarChart3Icon },
  { page: "integrations", label: "Integrations", icon: WrenchIcon },
]

export function TopNav({
  active,
  theme,
  onNavigate,
  onToggleTheme,
}: {
  active: DemoPage
  theme: DemoTheme
  onNavigate: (page: DemoPage) => void
  onToggleTheme: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span
        className="px-1 text-[13px] font-medium"
        style={{ color: V.fg, fontFamily: '"Geist Pixel", monospace' }}
      >
        tripwire
      </span>
      <div className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => (
          <span
            key={item.page}
            data-demo-nav={item.page}
            onClick={() => onNavigate(item.page)}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium"
            style={
              item.page === active
                ? { background: V.surface0, color: V.fg }
                : { color: V.fg2 }
            }
          >
            <item.icon size={12} />
            {item.label}
            {typeof item.count === "number" && (
              <span className="tabular-nums" style={{ color: V.fg2 }}>
                {item.count}
              </span>
            )}
          </span>
        ))}
      </div>
      <div
        className="ml-auto flex h-7 w-40 items-center gap-2 rounded-md px-2.5"
        style={{ background: V.surface1 }}
      >
        <SearchIcon size={11} style={{ color: V.fg2 }} />
        <span className="text-[11px]" style={{ color: V.fg2 }}>
          Search reports…
        </span>
      </div>
      {/* theme toggle — scoped to the demo */}
      <span
        onClick={onToggleTheme}
        className="flex size-7 items-center justify-center rounded-md"
        style={{ color: V.fg2 }}
        aria-label="Toggle demo theme"
      >
        {theme === "dark" ? <MoonIcon size={13} /> : <SunIcon size={13} />}
      </span>
      <span
        className="size-6 rounded-full"
        style={{
          border: `1px solid ${V.border}`,
          background: "linear-gradient(135deg, #6d28d9, #1e293b)",
        }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- atoms */

/** The bg-surface-0 pill pair used by every list header's sort control. */
export function SortToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (key: T) => void
}) {
  return (
    <div
      className="flex w-fit items-center gap-0.5 rounded-md p-0.5"
      style={{ background: V.surface0 }}
    >
      {options.map((o) => (
        <span
          key={o.key}
          onClick={() => onChange(o.key)}
          className="rounded-[5px] px-2.5 py-1 text-[11px] font-medium"
          style={
            o.key === value
              ? { background: V.card, color: V.fg }
              : { color: V.fg2 }
          }
        >
          {o.label}
        </span>
      ))}
    </div>
  )
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <span
      onClick={onClick}
      className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={
        active
          ? {
              borderColor: "transparent",
              background: V.primary,
              color: V.primaryFg,
            }
          : { borderColor: V.border, color: V.fg2 }
      }
    >
      {children}
    </span>
  )
}

export function ReasonPill({ children }: { children: string }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium"
      style={{ background: V.surface2, color: V.fg2 }}
    >
      {children}
    </span>
  )
}

export const SEVERITY_DOT: Record<string, string> = {
  Critical: ACCENT.red600,
  High: ACCENT.amber,
  Medium: "color-mix(in srgb, var(--d-fg2) 60%, transparent)",
  Low: "color-mix(in srgb, var(--d-fg2) 30%, transparent)",
}

export function SeverityBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-1.5 rounded-full"
        style={{ background: SEVERITY_DOT[label] }}
      />
      <span className="text-[11px]" style={{ color: V.fg2 }}>
        {label}
      </span>
    </span>
  )
}

export function CategoryPill({ children }: { children: string }) {
  return <ReasonPill>{children}</ReasonPill>
}

export function MiniSwitch({
  on,
  onToggle,
}: {
  on: boolean
  onToggle?: () => void
}) {
  return (
    <span
      onClick={onToggle}
      className="flex h-4 w-7 items-center rounded-full px-0.5"
      style={{
        background: on ? V.primary : V.surface2,
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span
        className="size-3 rounded-full"
        style={{ background: on ? V.primaryFg : V.fg2 }}
      />
    </span>
  )
}

/** Section header: "Moderation queue  (6)" + right-side controls. */
export function SectionHeader({
  title,
  count,
  right,
}: {
  title: string
  count?: number
  right?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-semibold" style={{ color: V.fg }}>
          {title}
        </h2>
        {typeof count === "number" && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ background: V.surface1, color: V.fg2 }}
          >
            {count}
          </span>
        )}
      </div>
      {right}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-[20px] font-semibold" style={{ color: V.fg }}>
        {title}
      </h1>
      <p className="text-[12px]" style={{ color: V.fg2 }}>
        {subtitle}
      </p>
    </header>
  )
}

/* ------------------------------------------------------------ stat card */

export type DitherColor =
  | "red"
  | "blue"
  | "purple"
  | "orange"
  | "pink"
  | "green"
  | "grey"

export type Metric = {
  key: string
  label: string
  value: string
  delta: number
  invertDelta?: boolean
  color: DitherColor
  series: number[]
  suffix?: string
}

export function Delta({
  delta,
  invertDelta,
}: {
  delta: number
  invertDelta?: boolean
}) {
  const good = invertDelta ? delta < 0 : delta > 0
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums"
      style={{ color: good ? ACCENT.good : ACCENT.bad }}
    >
      <span className="text-[8px] leading-none">{delta > 0 ? "▲" : "▼"}</span>
      {Math.abs(delta)}
    </span>
  )
}

/** modkit's DitherStatCard: label, value + delta, chart flush at the foot. */
export function StatCard({
  metric,
  onClick,
  focused = false,
  compact = false,
}: {
  metric: Metric
  onClick?: () => void
  /** Ringed, like the analytics sheet's focused metric. */
  focused?: boolean
  compact?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className="overflow-hidden rounded-xl"
      style={{
        background: V.card,
        boxShadow: focused
          ? "inset 0 0 0 1px color-mix(in srgb, var(--d-fg) 25%, transparent)"
          : undefined,
      }}
    >
      <div
        className={
          compact
            ? "flex flex-col gap-0.5 px-3 pt-2.5 pb-1.5"
            : "flex flex-col gap-1.5 px-3.5 pt-3.5 pb-2.5"
        }
      >
        <span
          className={compact ? "text-[11px]" : "text-[12px]"}
          style={{ color: V.fg2 }}
        >
          {metric.label}
        </span>
        <div className="flex items-baseline gap-2">
          <span
            className={compact ? "text-[16px]" : "font-sans text-[22px]"}
            style={{ color: V.fg }}
          >
            {metric.value}
            {metric.suffix ?? ""}
          </span>
          <Delta delta={metric.delta} invertDelta={metric.invertDelta} />
        </div>
      </div>
      <div className={compact ? "h-8" : "h-11"}>
        <Sparkline
          data={metric.series}
          color={metric.color}
          bloom="aura"
          animate
        />
      </div>
    </div>
  )
}
