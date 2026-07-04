"use client"

import {
  BanIcon,
  CheckIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  ShieldIcon,
  ThumbsUpIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { type ReactNode, useState } from "react"
import { Sparkline } from "#/components/dither-kit"
import { ACCENT, V } from "./theme"
import { CategoryPill, MiniSwitch, ReasonPill, SeverityBadge } from "./chrome"
import type { QueueItem, Rule } from "./data"

/**
 * The dashboard's side panel, exactly as modkit lays it out: the page is a
 * two-column grid whose right column springs between 0 and 328px, the main
 * content living in a rounded card that shrinks to make room.
 */
export function PanelGrid({
  open,
  main,
  panel,
}: {
  open: boolean
  main: ReactNode
  panel: ReactNode
}) {
  return (
    <motion.div
      animate={{
        gridTemplateColumns: open
          ? "minmax(0, 1fr) 328px"
          : "minmax(0, 1fr) 0px",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className="grid min-h-0 flex-1 overflow-hidden p-2 pt-0"
    >
      <div
        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl"
        style={{ background: V.card }}
      >
        {main}
      </div>
      <div className="overflow-hidden">
        <motion.div
          animate={{ opacity: open ? 1 : 0 }}
          transition={{
            duration: open ? 0.2 : 0.1,
            delay: open ? 0.1 : 0,
          }}
          className="h-full min-h-0 overflow-hidden pl-2"
        >
          {panel}
        </motion.div>
      </div>
    </motion.div>
  )
}

function PanelShell({
  icon,
  kind,
  onClose,
  children,
  footer,
}: {
  icon: ReactNode
  kind: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      className="flex h-full w-[328px] flex-col overflow-hidden rounded-xl border"
      style={{ background: V.card, borderColor: V.border }}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span
            className="truncate text-[11px] font-medium"
            style={{ color: V.fg2 }}
          >
            {kind}
          </span>
        </div>
        <span
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md"
          style={{ color: V.fg2 }}
          aria-label="Close details"
        >
          <XIcon size={13} />
        </span>
      </header>
      <div className="h-px shrink-0" style={{ background: V.border }} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        {children}
      </div>
      {footer && (
        <>
          <div className="h-px shrink-0" style={{ background: V.border }} />
          <footer className="p-3">{footer}</footer>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: V.fg2 }}>{label}</dt>
      <dd className="flex items-center gap-1.5" style={{ color: V.fg }}>
        {children}
      </dd>
    </div>
  )
}

function AvatarDot({ hue }: { hue: number }) {
  return (
    <span
      className="size-4 rounded-full border"
      style={{
        borderColor: V.border,
        background: `linear-gradient(135deg, hsl(${hue} 45% 55%), hsl(${hue + 40} 45% 35%))`,
      }}
    />
  )
}

/* --------------------------------------------------- moderation detail */

type Action = "approve" | "ban" | "remove"

const ACTION_META: Record<
  Action,
  {
    label: string
    confirm: string
    icon: typeof CheckIcon
    bg: string
    fg: string
  }
> = {
  approve: {
    label: "Approve",
    confirm: "Confirm Approve",
    icon: CheckIcon,
    bg: ACCENT.emerald600,
    fg: "#ffffff",
  },
  ban: {
    label: "Ban",
    confirm: "Confirm Ban",
    icon: BanIcon,
    bg: ACCENT.red600,
    fg: "#ffffff",
  },
  remove: {
    label: "Remove",
    confirm: "Confirm Remove",
    icon: Trash2Icon,
    bg: "var(--d-primary)",
    fg: "var(--d-primary-fg)",
  },
}

/** modkit's arm-then-confirm action bar: the armed button swells to fill the
 * row while its siblings collapse away. Confirming resolves the item. */
function ConfirmActions({ onResolve }: { onResolve: (a: Action) => void }) {
  const [armed, setArmed] = useState<Action | null>(null)
  const actions: Action[] = ["approve", "ban", "remove"]
  return (
    <div
      className="flex items-stretch gap-1 rounded-lg p-1"
      style={{ background: V.surface0 }}
    >
      {actions.map((a) => {
        const meta = ACTION_META[a]
        const isArmed = armed === a
        const hidden = armed !== null && !isArmed
        return (
          <motion.span
            key={a}
            layout
            onClick={() => (isArmed ? onResolve(a) : setArmed(a))}
            className="flex h-8 items-center justify-center gap-1.5 overflow-hidden rounded-md text-[11px] font-medium whitespace-nowrap"
            animate={{
              flexGrow: hidden ? 0.0001 : isArmed ? 6 : 1,
              opacity: hidden ? 0 : 1,
            }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            style={{
              flexBasis: 0,
              pointerEvents: hidden ? "none" : "auto",
              background: isArmed ? meta.bg : "transparent",
              color: isArmed ? meta.fg : V.fg2,
            }}
          >
            <meta.icon size={12} />
            {isArmed ? meta.confirm : meta.label}
          </motion.span>
        )
      })}
      {armed !== null && (
        <span
          onClick={() => setArmed(null)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ color: V.fg2 }}
        >
          <XIcon size={13} />
        </span>
      )}
    </div>
  )
}

export function ModerationDetail({
  item,
  onClose,
  onResolve,
}: {
  item: QueueItem
  onClose: () => void
  onResolve: () => void
}) {
  return (
    <PanelShell
      icon={<item.icon size={13} style={{ color: V.fg2 }} />}
      kind={`${item.kind} · #${item.number}`}
      onClose={onClose}
      footer={<ConfirmActions onResolve={() => onResolve()} />}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <ReasonPill>{item.reason}</ReasonPill>
            <SeverityBadge label={item.severity} />
          </div>
          <h3
            className="text-[13px] leading-snug font-semibold"
            style={{ color: V.fg }}
          >
            {item.title}
          </h3>
          <span
            className="inline-flex w-fit items-center gap-1 text-[11px]"
            style={{ color: V.fg2 }}
          >
            {item.repo}
            <ExternalLinkIcon size={10} />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px]" style={{ color: V.fg2 }}>
            Problematic content:
          </p>
          <p
            className="rounded-lg p-3 text-[11px] leading-relaxed"
            style={{ background: V.surface1, color: V.fg2 }}
          >
            {item.preview}
          </p>
        </div>

        <dl className="flex flex-col gap-2.5 text-[11px]">
          <Field label="Author">
            <AvatarDot hue={item.authorHue} />
            <span className="font-medium">{item.author}</span>
          </Field>
          <Field label="Reported by">
            {item.reporter === "automod" ? (
              <span className="font-mono">automod · {item.reason}</span>
            ) : (
              <>
                <AvatarDot hue={200} />
                <span className="font-medium">{item.reporter}</span>
              </>
            )}
          </Field>
          <Field label="Reported">{item.reportedAgo}</Field>
          <Field label="Activity">
            <span className="flex items-center gap-1 tabular-nums">
              <MessageSquareIcon size={11} />
              {item.comments}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <ThumbsUpIcon size={11} />
              {item.reactions}
            </span>
          </Field>
        </dl>
      </div>
    </PanelShell>
  )
}

/* --------------------------------------------------------- rule detail */

export function RuleDetail({
  rule,
  onClose,
  onToggle,
}: {
  rule: Rule
  onClose: () => void
  onToggle: () => void
}) {
  const [verdicts, setVerdicts] = useState<
    Record<string, "confirmed" | "false-positive">
  >({})
  return (
    <PanelShell
      icon={<ShieldIcon size={13} style={{ color: V.fg2 }} />}
      kind="Automod rule"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <CategoryPill>{rule.category}</CategoryPill>
            <MiniSwitch on={rule.enabled} onToggle={onToggle} />
          </div>
          <h3
            className="text-[13px] leading-snug font-semibold"
            style={{ color: V.fg }}
          >
            {rule.name}
          </h3>
          <p className="text-[11px] leading-relaxed" style={{ color: V.fg2 }}>
            {rule.description}
          </p>
        </div>

        <code
          className="block overflow-hidden rounded-lg px-3 py-2 font-mono text-[10px]"
          style={{ background: V.surface1, color: V.fg }}
        >
          {rule.pattern}
        </code>

        <div className="rounded-lg p-3" style={{ background: V.surface1 }}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p
                className="text-[16px] leading-none font-semibold tabular-nums"
                style={{ color: V.fg }}
              >
                {rule.hits}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: V.fg2 }}>
                matches · 24h
              </p>
            </div>
            <div className="h-9 w-28">
              <Sparkline data={rule.series} color="blue" bloom="aura" animate />
            </div>
          </div>
        </div>

        <dl className="flex flex-col gap-2.5 text-[11px]">
          <Field label="Scope">{rule.scope}</Field>
          <Field label="Action">{rule.action}</Field>
          <Field label="False-positive rate">
            <span
              className="tabular-nums"
              style={{ color: rule.fpRate >= 15 ? ACCENT.amber : V.fg }}
            >
              {rule.fpRate}%
            </span>
          </Field>
          <Field label="Last fired">{rule.lastFired}</Field>
        </dl>

        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-[11px] font-medium" style={{ color: V.fg2 }}>
            Recent matches
          </p>
          {rule.matches.map((m) => {
            const verdict = verdicts[m.id]
            return (
              <div
                key={m.id}
                className="flex flex-col gap-1.5 rounded-lg p-2.5"
                style={{ background: V.surface1 }}
              >
                <div
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: V.fg2 }}
                >
                  <span className="truncate">{m.where}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{m.ago}</span>
                </div>
                <p className="line-clamp-2 text-[11px]" style={{ color: V.fg }}>
                  {m.snippet}
                </p>
                {verdict ? (
                  <span
                    className="inline-flex w-fit items-center gap-1.5 text-[10px]"
                    style={{ color: V.fg2 }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        background:
                          verdict === "false-positive"
                            ? ACCENT.amber
                            : ACCENT.good,
                      }}
                    />
                    {verdict === "false-positive"
                      ? "False positive"
                      : "Confirmed"}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span
                      onClick={() =>
                        setVerdicts((v) => ({ ...v, [m.id]: "confirmed" }))
                      }
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: V.surface2, color: V.fg2 }}
                    >
                      <CheckIcon size={10} />
                      Confirm
                    </span>
                    <span
                      onClick={() =>
                        setVerdicts((v) => ({
                          ...v,
                          [m.id]: "false-positive",
                        }))
                      }
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: V.surface2, color: V.fg2 }}
                    >
                      <ShieldIcon size={10} />
                      False positive
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </PanelShell>
  )
}
