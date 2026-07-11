"use client"

import { CheckIcon, CopyIcon, RefreshCcwIcon } from "lucide-react"
import { Fragment, type ReactNode, useState } from "react"

/** The dither-kit docs page's building blocks: the checkerboard strip motif,
 * copy affordances, the tiny syntax highlighter, and the showcase card. */

/** The page's signature motif: a strip of ordered-dither checkerboard that
 * fades out — the same texture the charts are made of, as page chrome. */
export function DitherStrip({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`text-border ${className}`}
      style={{
        backgroundImage:
          "repeating-conic-gradient(currentColor 0% 25%, transparent 0% 50%)",
        backgroundSize: "6px 6px",
        maskImage:
          "linear-gradient(to right, transparent, black 18%, black 82%, transparent)",
      }}
    />
  )
}

/* ---------------------------------------------------------------- theme */

export type PageThemeState = {
  light: boolean
  toggle: () => void
}

// Storage can be disabled (private mode, embedded webviews) — the toggle
// keeps working in memory either way.
const readPageTheme = (): boolean => {
  try {
    return window.localStorage.getItem("dither-kit-theme") === "light"
  } catch {
    return false
  }
}

const writePageTheme = (light: boolean): void => {
  try {
    window.localStorage.setItem("dither-kit-theme", light ? "light" : "dark")
  } catch {
    // Keep the in-memory toggle working.
  }
}

/** Page-scoped theme. The app is dark-only, so instead of a global theme the
 * page swaps the `.dither-light` token overrides (and the `dark` class that
 * drives `dark:` variants) on its own wrapper. Persisted per visitor. */
export function usePageTheme(): PageThemeState {
  const [light, setLight] = useState(
    () => typeof window !== "undefined" && readPageTheme()
  )
  const toggle = () => {
    setLight((value) => {
      const next = !value
      writePageTheme(next)
      return next
    })
  }
  return { light, toggle }
}

/* ----------------------------------------------------------------- copy */

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  return { copied, copy }
}

/** A copyable terminal line. */
export function CopyLine({ text }: { text: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className="group flex w-full items-center justify-between gap-4 rounded-lg border bg-card/60 px-4 py-2.5 text-left font-mono text-xs text-foreground transition-colors hover:border-foreground/25 hover:bg-card"
    >
      <span className="truncate">
        <span className="text-muted-foreground select-none">$ </span>
        {text}
      </span>
      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
        {copied ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </span>
    </button>
  )
}

/** A dithered "or" divider between two install paths. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <DitherStrip className="h-1.5 flex-1" />
      <span className="font-mono text-[11px] text-muted-foreground uppercase select-none">
        {label}
      </span>
      <DitherStrip className="h-1.5 flex-1" />
    </div>
  )
}

/** A full-width button that copies a longer payload (e.g. an AI setup prompt),
 * with its own label and icon rather than the `$`-prefixed terminal styling. */
export function CopyButton({
  text,
  label,
  icon,
}: {
  text: string
  label: string
  icon?: ReactNode
}) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-card/40 px-4 py-2.5 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-card hover:text-foreground"
    >
      <span className="shrink-0 transition-colors group-hover:text-foreground">
        {copied ? (
          <CheckIcon className="size-3.5" />
        ) : (
          (icon ?? <CopyIcon className="size-3.5" />)
        )}
      </span>
      {copied ? "copied to clipboard" : label}
    </button>
  )
}

/* --------------------------------------------------- syntax highlighting */

type TokenType = "comment" | "string" | "tag" | "attr" | "number" | "punct"

const TOKEN_RE =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(<\/?[A-Za-z][\w.]*|\/?>)|(\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b)|([A-Za-z_]\w*(?==))|([{}()[\]=|,:])/g

const TOKEN_CLASS: Record<TokenType, string> = {
  comment: "text-muted-foreground/60 italic",
  string: "text-emerald-600 dark:text-emerald-400",
  tag: "text-sky-600 dark:text-sky-400",
  number: "text-orange-600 dark:text-orange-400",
  attr: "text-violet-600 dark:text-violet-400",
  punct: "text-muted-foreground/70",
}

type Token = { type: TokenType | null; text: string; start: number }

/** Pure tokenizer — `matchAll` leaves the shared regex untouched, and each
 * token carries its source offset for a stable render key. */
function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const m of code.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0
    if (start > last)
      tokens.push({ type: null, text: code.slice(last, start), start: last })
    const type: TokenType = m[1]
      ? "comment"
      : m[2]
        ? "string"
        : m[3]
          ? "tag"
          : m[4]
            ? "number"
            : m[5]
              ? "attr"
              : "punct"
    tokens.push({ type, text: m[0], start })
    last = start + m[0].length
  }
  if (last < code.length)
    tokens.push({ type: null, text: code.slice(last), start: last })
  return tokens
}

/** Tiny JSX-ish highlighter for the docs snippets — no dependency, themed to
 * the dither palette, adapts to light and dark via classes. */
export function Code({ code }: { code: string }) {
  return (
    <>
      {tokenize(code).map((t) =>
        t.type ? (
          <span key={t.start} className={TOKEN_CLASS[t.type]}>
            {t.text}
          </span>
        ) : (
          <Fragment key={t.start}>{t.text}</Fragment>
        )
      )}
    </>
  )
}

export function CodeBlock({ code }: { code: string }) {
  const { copied, copy } = useCopy()
  return (
    <div className="group relative">
      <pre className="h-full overflow-x-auto rounded-lg border bg-card/60 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <code>
          <Code code={code} />
        </code>
      </pre>
      <button
        type="button"
        onClick={() => copy(code)}
        aria-label="Copy code"
        className="absolute top-2 right-2 rounded-md border bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        {copied ? (
          <CheckIcon className="size-3" />
        ) : (
          <CopyIcon className="size-3" />
        )}
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- pills */

/** Tiny pill toggle used for tabs and boolean tweaks. */
export function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "text-muted-foreground hover:border-foreground/25 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

export function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Replay entrance animation"
      className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      <RefreshCcwIcon className="size-3.5" />
    </button>
  )
}

/* -------------------------------------------------------------- showcase */

export function Showcase({
  title,
  install,
  code,
  toolbar,
  children,
  tall = false,
}: {
  title: string
  install: string
  code: string
  /** Extra controls rendered in the card toolbar (e.g. replay). */
  toolbar?: ReactNode
  children: ReactNode
  tall?: boolean
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview")
  const { copied, copy } = useCopy()
  return (
    <section
      id={title.toLowerCase().replace(/[^a-z]+/g, "-")}
      className="flex flex-col gap-4"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-pixel-geist text-sm text-foreground">{title}</h3>
        <button
          type="button"
          onClick={() => copy(install)}
          className="hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:flex"
        >
          {copied ? (
            <CheckIcon className="size-3" />
          ) : (
            <CopyIcon className="size-3" />
          )}
          {install.split(" add ").pop()}
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {toolbar}
          <Pill
            label="preview"
            active={tab === "preview"}
            onClick={() => setTab("preview")}
          />
          <Pill
            label="code"
            active={tab === "code"}
            onClick={() => setTab("code")}
          />
        </div>
      </div>

      {/* Body */}
      {tab === "preview" ? (
        <div className={`relative ${tall ? "h-80" : "h-64"}`}>{children}</div>
      ) : (
        <div className={`${tall ? "h-80" : "h-64"} overflow-y-auto`}>
          <CodeBlock code={code} />
        </div>
      )}
    </section>
  )
}
