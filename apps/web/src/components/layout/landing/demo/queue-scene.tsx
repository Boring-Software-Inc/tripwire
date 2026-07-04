"use client"

import { motion } from "motion/react"
import { useState } from "react"
import {
  FilterChip,
  type Metric,
  PageHeader,
  ReasonPill,
  SectionHeader,
  SeverityBadge,
  SortToggle,
  StatCard,
} from "./chrome"
import { METRICS, type QueueItem } from "./data"
import { listStagger, rowIn } from "./motion"
import { V } from "./theme"

const REASONS = [
  "All reasons",
  "Spam",
  "Harassment",
  "Off-topic",
  "Automod",
  "NSFW",
] as const

/** modkit's home: stat cards over the moderation queue, with the real sort
 * toggle, reason chips, and rows that open the detail panel. */
export function QueueScene({
  items,
  activeItemId,
  onOpenItem,
  onOpenMetric,
}: {
  items: QueueItem[]
  activeItemId: string | null
  onOpenItem: (item: QueueItem) => void
  onOpenMetric: (metric: Metric) => void
}) {
  const [sort, setSort] = useState<"severity" | "newest">("severity")
  const [reason, setReason] = useState<(typeof REASONS)[number]>("All reasons")

  const visible = items
    .filter((i) => reason === "All reasons" || i.reason === reason)
    .sort((a, b) =>
      sort === "severity"
        ? b.severityWeight - a.severityWeight
        : a.ageMinutes - b.ageMinutes
    )

  return (
    <motion.div
      className="flex flex-col gap-4 px-5 pt-4 pb-4"
      variants={listStagger}
    >
      <motion.div variants={rowIn}>
        <PageHeader
          title="Moderation"
          subtitle="Triage flagged issues, pull requests, and comments across your organization."
        />
      </motion.div>

      {/* the four dither stat cards — each opens its analytics view */}
      <motion.div variants={rowIn} className="grid grid-cols-4 gap-3">
        {METRICS.moderation.map((m) => (
          <StatCard key={m.key} metric={m} onClick={() => onOpenMetric(m)} />
        ))}
      </motion.div>

      <motion.div variants={rowIn} className="flex flex-col gap-2.5">
        <SectionHeader
          title="Moderation queue"
          count={visible.length}
          right={
            <SortToggle
              options={[
                { key: "severity", label: "Severity" },
                { key: "newest", label: "Newest" },
              ]}
              value={sort}
              onChange={setSort}
            />
          }
        />
        <div className="flex items-center gap-1.5 overflow-hidden px-3">
          {REASONS.map((r) => (
            <FilterChip
              key={r}
              active={reason === r}
              onClick={() => setReason(r)}
            >
              {r}
            </FilterChip>
          ))}
        </div>
      </motion.div>

      <motion.div variants={rowIn} className="flex flex-col gap-1">
        {visible.map((q) => (
          <motion.div
            key={q.id}
            layout
            transition={{ type: "spring", stiffness: 600, damping: 44 }}
            onClick={() => onOpenItem(q)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
            style={{
              background: activeItemId === q.id ? V.muted : "transparent",
            }}
          >
            <q.icon
              size={13}
              style={{ color: V.fg2 }}
              className="mt-0.5 shrink-0 self-start"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className="truncate text-[12px] font-medium"
                style={{ color: V.fg }}
              >
                {q.title}
              </span>
              <span className="truncate text-[11px]" style={{ color: V.fg2 }}>
                {q.repo} #{q.number} · {q.reportedAgo}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ReasonPill>{q.reason}</ReasonPill>
              <SeverityBadge label={q.severity} />
            </div>
          </motion.div>
        ))}
        {visible.length === 0 && (
          <p
            className="px-3 py-8 text-center text-[11px]"
            style={{ color: V.fg2 }}
          >
            Nothing flagged for this reason. Nice.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
