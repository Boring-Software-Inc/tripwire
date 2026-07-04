"use client"

import { ShieldIcon } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import { Sparkline } from "#/components/dither-kit"
import {
  FilterChip,
  type Metric,
  MiniSwitch,
  PageHeader,
  SectionHeader,
  SortToggle,
  StatCard,
} from "./chrome"
import { METRICS, type Rule } from "./data"
import { listStagger, rowIn } from "./motion"
import { V } from "./theme"

const CATEGORIES = [
  "All categories",
  "Blocklist",
  "Heuristic",
  "Classifier",
  "Regex",
] as const

/** modkit's automod page: stat cards, sort + category chips, rule rows with
 * live switches — rows open the rule detail panel. */
export function AutomodScene({
  rules,
  activeRuleId,
  onOpenRule,
  onToggleRule,
  onOpenMetric,
}: {
  rules: Rule[]
  activeRuleId: string | null
  onOpenRule: (rule: Rule) => void
  onToggleRule: (rule: Rule) => void
  onOpenMetric: (metric: Metric) => void
}) {
  const [sort, setSort] = useState<"active" | "fp" | "name">("active")
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("All categories")

  const visible = rules
    .filter((r) => category === "All categories" || r.category === category)
    .sort((a, b) =>
      sort === "active"
        ? b.hits - a.hits
        : sort === "fp"
          ? b.fpRate - a.fpRate
          : a.name.localeCompare(b.name)
    )

  return (
    <motion.div
      className="flex flex-col gap-4 px-5 pt-4 pb-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn}>
        <PageHeader
          title="Automod"
          subtitle="Tune the rules that flag, hide, and auto-action content before it reaches the queue."
        />
      </motion.div>

      <motion.div variants={rowIn} className="grid grid-cols-4 gap-3">
        {METRICS.automod.map((m) => (
          <StatCard key={m.key} metric={m} onClick={() => onOpenMetric(m)} />
        ))}
      </motion.div>

      <motion.div variants={rowIn} className="flex flex-col gap-2.5">
        <SectionHeader
          title="Rules"
          count={visible.length}
          right={
            <SortToggle
              options={[
                { key: "active", label: "Most active" },
                { key: "fp", label: "FP rate" },
                { key: "name", label: "A–Z" },
              ]}
              value={sort}
              onChange={setSort}
            />
          }
        />
        <div className="flex items-center gap-1.5 overflow-hidden px-3">
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </FilterChip>
          ))}
        </div>
      </motion.div>

      <motion.div variants={rowIn} className="flex flex-col gap-1">
        {visible.map((r) => (
          <motion.div
            key={r.id}
            layout
            transition={{ type: "spring", stiffness: 600, damping: 44 }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
            style={{
              background: activeRuleId === r.id ? V.muted : "transparent",
            }}
          >
            <span
              onClick={() => onOpenRule(r)}
              className="flex min-w-0 flex-1 items-center gap-3"
              style={{ opacity: r.enabled ? 1 : 0.5 }}
            >
              <ShieldIcon
                size={13}
                style={{ color: V.fg2 }}
                className="shrink-0"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className="truncate text-[12px] font-medium"
                  style={{ color: V.fg }}
                >
                  {r.name}
                </span>
                <span className="truncate text-[11px]" style={{ color: V.fg2 }}>
                  {r.action} · {r.scope}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-5">
                <span className="h-7 w-20">
                  <Sparkline
                    data={r.series}
                    color={r.enabled ? "blue" : "grey"}
                    bloom="aura"
                    animate
                  />
                </span>
                <span className="w-10 text-right">
                  <span
                    className="block text-[12px] leading-none font-medium tabular-nums"
                    style={{ color: V.fg }}
                  >
                    {r.hits}
                  </span>
                  <span
                    className="mt-1 block text-[10px]"
                    style={{ color: V.fg2 }}
                  >
                    24h
                  </span>
                </span>
              </span>
            </span>
            <MiniSwitch on={r.enabled} onToggle={() => onToggleRule(r)} />
          </motion.div>
        ))}
        {visible.length === 0 && (
          <p
            className="px-3 py-8 text-center text-[11px]"
            style={{ color: V.fg2 }}
          >
            No automod rules match this category.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
