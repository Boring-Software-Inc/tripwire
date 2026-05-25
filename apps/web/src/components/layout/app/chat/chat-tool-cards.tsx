import { useState, type ReactNode } from "react"
import { JSONUIProvider, Renderer } from "@json-render/react"
import { Button } from "@tripwire/ui/button"
import { UnicodeSpinner } from "@tripwire/ui/unicode-spinner"
import { registry } from "@tripwire/ui"
import type { ActionResultData, MessagePart, RenderSpec } from "#/types/chat"
import {
  formatToolArgs,
  formatToolName,
  getApprovalText,
  getBatchApprovalText,
  getPartToolName,
  getToolCallId,
  getToolInput,
} from "#/lib/chat/format"
import {
  getBriefActionText,
  renderInlineText,
} from "#/components/layout/app/chat/chips"
import { MarkdownText } from "#/components/layout/app/chat/markdown-text"
import {
  BatchResultErrorRingIcon14,
  BatchResultSuccessRingIcon14,
  ThoughtCollapsibleChevronIcon10,
  ToolStepErrorRingIcon12,
  ToolStepSuccessRingIcon12,
} from "@tripwire/ui/icons/chat-thread-status-icons"

interface ToolStepProps {
  toolName: string
  args: Record<string, unknown>
  state: string
}

/** Tool finished with json-render output — skip collapsible ToolStep chrome. */
export function coerceToolOutput(output: unknown): unknown {
  if (typeof output === "string") {
    try {
      return JSON.parse(output) as unknown
    } catch {
      return output
    }
  }
  return output
}

export function isRenderSpecPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.root === "string" &&
    r.elements !== undefined &&
    typeof r.elements === "object" &&
    r.elements !== null
  )
}

export function ToolStep({ toolName, args, state }: ToolStepProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isComplete =
    state === "input-complete" ||
    state === "approval-responded" ||
    state === "output-available" ||
    state === "output-denied"
  const isError = state === "error" || state === "output-error"
  const displayName = formatToolName(toolName)
  const argsStr = formatToolArgs(toolName, args)
  const hasArgs = Object.keys(args).length > 0

  return (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        type="button"
        onClick={() => hasArgs && setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-start gap-2 py-0.5 text-[12px] text-tw-text-muted ${hasArgs ? "cursor-pointer hover:text-[#E0E0E0]" : "cursor-default"} transition-colors`}
      >
        {isError ? (
          <ToolStepErrorRingIcon12 className="shrink-0 text-red-400/60" />
        ) : isComplete ? (
          <ToolStepSuccessRingIcon12 className="shrink-0 text-tw-success/60" />
        ) : (
          <UnicodeSpinner
            variant="dots"
            className="text-[12px] text-tw-text-secondary"
            label={displayName}
          />
        )}
        <span className={isComplete ? "" : "text-tw-text-secondary"}>
          {displayName}
        </span>
        {!isOpen && argsStr && (
          <span className="max-w-[140px] truncate text-tw-text-tertiary">
            {argsStr}
          </span>
        )}
      </Button>
      {isOpen && hasArgs && (
        <div className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 text-[11px]">
          {Object.entries(args).map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="shrink-0 text-tw-text-muted">{key}</span>
              <span className="truncate font-mono text-tw-text-secondary">
                {typeof val === "string" ? val : JSON.stringify(val)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReasoningBlock({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!content.trim()) return null

  return (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-start gap-1.5 py-0.5 text-[12px] text-tw-text-muted transition-colors hover:text-tw-text-secondary"
      >
        <ThoughtCollapsibleChevronIcon10
          className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
        <span className="text-[13px] text-tw-text-secondary">Thinking</span>
      </Button>
      {isOpen && (
        <div className="border-l border-[#27272A] pl-4 text-[12px] leading-[18px] text-tw-text-muted/70">
          <MarkdownText content={content} />
        </div>
      )}
    </div>
  )
}

interface ToolApprovalCardProps {
  toolName: string
  args: Record<string, unknown>
  onApprove: () => void
  onDeny: () => void
}

export function ToolApprovalCard({
  toolName,
  args,
  onApprove,
  onDeny,
}: ToolApprovalCardProps) {
  const username = args.username as string | undefined
  const { text, yesLabel, noLabel } = getApprovalText(toolName, username)

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-tw-card p-3">
      <div className="text-[13px] text-tw-text-primary">
        {renderInlineText(text)}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={onApprove}
          className="h-7 rounded-lg bg-tw-text-primary px-3 text-[12px] font-medium text-[#0D0D0F] transition-opacity hover:opacity-90"
        >
          {yesLabel}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={onDeny}
          className="h-7 rounded-lg bg-tw-hover px-3 text-[12px] font-medium text-tw-text-secondary transition-colors hover:text-tw-text-primary"
        >
          {noLabel}
        </Button>
      </div>
    </div>
  )
}

interface BatchApprovalCardProps {
  approvals: Array<MessagePart & { approval: { id: string } }>
  onApproveAll: () => void
  onDenyAll: () => void
}

export function BatchApprovalCard({
  approvals,
  onApproveAll,
  onDenyAll,
}: BatchApprovalCardProps) {
  const parsed = approvals.map((part) => {
    const toolArgs = getToolInput(part)
    return {
      name: getPartToolName(part),
      username: toolArgs.username as string | undefined,
    }
  })

  const allSameAction = parsed.every((p) => p.name === parsed[0].name)
  const usernames = parsed.map((p) => p.username).filter(Boolean) as string[]

  if (allSameAction && usernames.length > 1) {
    const action = parsed[0].name
    const lastUser = usernames[usernames.length - 1]
    const userList =
      usernames
        .slice(0, -1)
        .map((u) => `@${u}`)
        .join(", ") + ` and @${lastUser}`
    const { prefix, suffix, consequence, buttonLabel } =
      getBatchApprovalText(action)

    return (
      <div className="flex flex-col gap-2 rounded-xl bg-tw-card p-3">
        <div className="text-[13px] text-tw-text-primary">
          {prefix} {renderInlineText(userList)}
          {suffix ? ` ${suffix}` : ""}?
        </div>
        {consequence && (
          <div className="text-[12px] text-tw-text-muted">{consequence}</div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={onApproveAll}
            className="h-7 rounded-lg bg-tw-text-primary px-3 text-[12px] font-medium text-[#0D0D0F] transition-opacity hover:opacity-90"
          >
            Yes, {buttonLabel}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={onDenyAll}
            className="h-7 rounded-lg bg-tw-hover px-3 text-[12px] font-medium text-tw-text-secondary transition-colors hover:text-tw-text-primary"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-tw-card p-3">
      <div className="text-[12px] tracking-wider text-tw-text-muted uppercase">
        {approvals.length} actions
      </div>
      <div className="flex flex-col gap-1">
        {parsed.map((p, i) => (
          <div
            key={getToolCallId(approvals[i]) ?? approvals[i].approval.id}
            className="flex items-center gap-2 text-[13px] text-tw-text-primary"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-tw-warning" />
            {getBriefActionText(p.name, p.username)}
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={onApproveAll}
          className="h-7 rounded-lg bg-tw-text-primary px-3 text-[12px] font-medium text-[#0D0D0F] transition-opacity hover:opacity-90"
        >
          Approve all
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={onDenyAll}
          className="h-7 rounded-lg bg-tw-hover px-3 text-[12px] font-medium text-tw-text-secondary transition-colors hover:text-tw-text-primary"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function ToolResultDisplay({
  result,
  fallback = null,
}: {
  result: unknown
  fallback?: ReactNode
}) {
  let parsed = result
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return fallback
    }
  }
  if (!parsed || typeof parsed !== "object") return fallback

  const r = parsed as Record<string, unknown>

  if ("root" in r && "elements" in r && typeof r.root === "string") {
    return (
      <JSONUIProvider registry={registry}>
        <Renderer spec={r as unknown as RenderSpec} registry={registry} />
      </JSONUIProvider>
    )
  }

  return fallback
}

export function CombinedActionResult({
  results,
}: {
  results: ActionResultData[]
}) {
  if (results.length === 0) return null

  const allSuccess = results.every((r) => r.success)
  const usernames = results.map((r) => r.username).filter(Boolean) as string[]

  let message: string
  if (usernames.length <= 1) {
    message = results[0].message
  } else {
    const firstMsg = results[0].message
    const match = firstMsg.match(/^@\w+\s+has\s+been\s+(.+)$/)

    if (match) {
      const lastUser = usernames.pop() as string
      const userList = "@" + usernames.join(", @") + ` and @${lastUser}`
      message = `${userList} have been ${match[1]}`
    } else {
      const lastUser = usernames.pop() as string
      const userList = "@" + usernames.join(", @") + ` and @${lastUser}`
      message = `${userList}: ${results[0].message.replace(/@\w+\s*/, "")}`
    }
  }

  const bgColor = allSuccess
    ? "bg-[#4ADE801A] border-tw-success/20"
    : "bg-[#F56D5D1A] border-tw-error/20"
  const iconColor = allSuccess ? "text-tw-success" : "text-tw-error"

  return (
    <div className={`flex items-center gap-2 rounded-xl border p-3 ${bgColor}`}>
      {allSuccess ? (
        <BatchResultSuccessRingIcon14 className={iconColor} />
      ) : (
        <BatchResultErrorRingIcon14 className={iconColor} />
      )}
      <span className="text-[13px] text-tw-text-primary">
        {renderInlineText(message)}
      </span>
    </div>
  )
}
