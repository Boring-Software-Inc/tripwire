import { createFileRoute } from "@tanstack/react-router"
import { DialRoot, useDialKit } from "dialkit"
import "dialkit/styles.css"
import {
  CheckIcon,
  CopyIcon,
  MoonIcon,
  RefreshCcwIcon,
  SunIcon,
} from "lucide-react"
import { Fragment, type ReactNode, useState } from "react"
import {
  ActiveDot,
  Area,
  AreaChart,
  type AreaVariant,
  Bar,
  BarChart,
  type BloomInput,
  type ChartConfig,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "#/components/dither-kit"

export const Route = createFileRoute("/dither-kit")({
  ssr: false,
  component: DitherKitDocs,
})

/** Where the registry lives once deployed. */
const HOST = "https://tripwire.sh"

/* ------------------------------------------------------- package manager */

const PMS = ["npm", "pnpm", "yarn", "bun"] as const
type Pm = (typeof PMS)[number]

/** The runner each package manager uses for one-off CLIs. */
const PM_RUNNER: Record<Pm, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
  bun: "bunx --bun",
}

const addCmd = (pm: Pm, item: string) =>
  `${PM_RUNNER[pm]} shadcn@latest add ${item}`

/* ------------------------------------------------------------------ data */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]
const series = MONTHS.map((month, i) => ({
  month,
  desktop: Math.round(120 + 90 * Math.sin(i * 0.7) + i * 14),
  mobile: Math.round(70 + 50 * Math.cos(i * 0.5) + i * 8),
}))
const config: ChartConfig = {
  desktop: { label: "Desktop", color: "blue" },
  mobile: { label: "Mobile", color: "purple" },
}
const pieData = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 120 },
  { browser: "other", visitors: 90 },
]
const pieConfig: ChartConfig = {
  chrome: { label: "Chrome", color: "blue" },
  safari: { label: "Safari", color: "green" },
  firefox: { label: "Firefox", color: "orange" },
  edge: { label: "Edge", color: "purple" },
  other: { label: "Other", color: "grey" },
}
const radarData = [
  { skill: "Speed", desktop: 186, mobile: 120 },
  { skill: "Power", desktop: 205, mobile: 98 },
  { skill: "Range", desktop: 137, mobile: 160 },
  { skill: "Defense", desktop: 173, mobile: 125 },
  { skill: "Magic", desktop: 160, mobile: 190 },
  { skill: "Luck", desktop: 144, mobile: 110 },
]

/* ---------------------------------------------------------- live tweaks */

const VARIANTS: AreaVariant[] = ["gradient", "dotted", "hatched", "solid"]
const BLOOM_PRESETS = ["off", "low", "high", "aura", "custom"] as const
type BloomPreset = (typeof BLOOM_PRESETS)[number]

type Tweaks = {
  bloomPreset: BloomPreset
  blur: number
  brightness: number
  opacity: number
  saturate: number
  primaryVariant: AreaVariant
  secondaryVariant: AreaVariant
  stacked: boolean
  donutRadius: number // 0 = full pie
  duration: number // entrance ms
}

function bloomOf(t: Tweaks): BloomInput {
  return t.bloomPreset === "custom"
    ? {
        blur: t.blur,
        brightness: t.brightness,
        opacity: t.opacity,
        saturate: t.saturate,
      }
    : t.bloomPreset
}

/** How the current bloom reads in the code snippets. */
function bloomAttr(t: Tweaks): string {
  if (t.bloomPreset === "custom") {
    return ` bloom={{ blur: ${t.blur}, brightness: ${t.brightness}, opacity: ${t.opacity}, saturate: ${t.saturate} }}`
  }
  return t.bloomPreset === "off" ? "" : ` bloom="${t.bloomPreset}"`
}

/* ------------------------------------------------------------ primitives */

/** The page's signature motif: a strip of ordered-dither checkerboard that
 * fades out — the same texture the charts are made of, as page chrome. */
function DitherStrip({ className = "" }: { className?: string }) {
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

/** Page-scoped theme. The app is dark-only, so instead of a global theme the
 * page swaps the `.dither-light` token overrides (and the `dark` class that
 * drives `dark:` variants) on its own wrapper. Persisted per visitor. */
function usePageTheme() {
  const [light, setLight] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("dither-kit-theme") === "light"
  )
  const toggle = () => {
    setLight((v) => {
      window.localStorage.setItem("dither-kit-theme", v ? "dark" : "light")
      return !v
    })
  }
  return { light, toggle }
}

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
function CopyLine({ text }: { text: string }) {
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
function Code({ code }: { code: string }) {
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

function CodeBlock({ code }: { code: string }) {
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

/** Tiny pill toggle used for tabs and boolean tweaks. */
function Pill({
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

function ReplayButton({ onClick }: { onClick: () => void }) {
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

function Showcase({
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

/* ------------------------------------------------------------------ page */

function DitherKitDocs() {
  const { light, toggle: toggleTheme } = usePageTheme()
  const [pm, setPm] = useState<Pm>("npm")

  // One replay counter per showcase so a replay never re-runs its neighbours.
  const [replays, setReplays] = useState({
    hero: 0,
    area: 0,
    bar: 0,
    line: 0,
    pie: 0,
    radar: 0,
  })
  const replay = (key: keyof typeof replays) =>
    setReplays((r) => ({ ...r, [key]: r[key] + 1 }))
  const replayAll = () =>
    setReplays(
      (r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k, v + 1])
        ) as typeof replays
    )

  // The live tweak panel — DialKit (https://joshpuckett.me/dialkit) renders a
  // floating control surface from this config; every preview and code snippet
  // on the page follows it.
  const params = useDialKit(
    "dither-kit",
    {
      bloom: {
        preset: {
          type: "select",
          options: ["off", "low", "high", "aura", "custom"],
          default: "aura",
        },
        blur: [24, 0, 32, 1],
        brightness: [2.9, 1, 4, 0.1],
        opacity: [0.1, 0.05, 1, 0.05],
        saturate: [3, 1, 4, 0.25],
        _collapsed: true,
      },
      desktopVariant: {
        type: "select",
        options: VARIANTS,
        default: "gradient",
      },
      mobileVariant: {
        type: "select",
        options: VARIANTS,
        default: "hatched",
      },
      stacked: true,
      pieInnerRadius: [0.5, 0, 0.8, 0.05],
      entranceMs: [900, 300, 2400, 100],
      replayAll: { type: "action" },
    },
    {
      onAction: (path: string) => {
        if (path === "replayAll") replayAll()
      },
    }
  )

  const tweaks: Tweaks = {
    bloomPreset: params.bloom.preset as BloomPreset,
    blur: params.bloom.blur,
    brightness: params.bloom.brightness,
    opacity: params.bloom.opacity,
    saturate: params.bloom.saturate,
    primaryVariant: params.desktopVariant as AreaVariant,
    secondaryVariant: params.mobileVariant as AreaVariant,
    stacked: params.stacked,
    donutRadius: params.pieInnerRadius,
    duration: params.entranceMs,
  }
  const bloom = bloomOf(tweaks)

  // Register the namespace once, then install any chart by name.
  const registries = `// components.json\n{\n  "registries": {\n    "@dither-kit": "${HOST}/r/{name}.json"\n  }\n}`

  return (
    // The tweak panel docks on the right; content slides over so the charts
    // stay in view while you turn the knobs.
    <div
      className={`min-h-screen bg-background text-foreground ${
        light ? "dither-light" : "dark"
      }`}
    >
      <DitherStrip className="h-2 w-full" />

      <div className="mx-auto flex max-w-4xl flex-col gap-20 px-6 py-16">
        {/* Hero */}
        <header className="flex flex-col gap-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-pixel-geist text-4xl text-foreground sm:text-5xl">
                dither-kit
              </h1>
              <p className="font-mono text-xs text-muted-foreground">
                five chart types on one tiny canvas engine, no recharts
              </p>
            </div>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="rounded-md border p-2 text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {light ? (
                <MoonIcon className="size-4" />
              ) : (
                <SunIcon className="size-4" />
              )}
            </button>
          </div>

          <p className="max-w-2xl leading-relaxed text-balance text-muted-foreground">
            Composable, <span className="text-foreground">dithered</span> charts
            with a recharts-style children-as-config API. Ordered-dither fills
            that hold up in light and dark, entrance animations, a gliding scrub
            tooltip, selection, winking sparkles, and colour bloom.
          </p>

          {/* Hero chart */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                scrub it, hover a legend entry to spotlight that series, click
                to lock it
              </span>
              <ReplayButton onClick={() => replay("hero")} />
            </div>
            <div className="h-72">
              <AreaChart
                data={series}
                config={config}
                stackType={tweaks.stacked ? "stacked" : "default"}
                bloom={bloom}
                animationDuration={tweaks.duration}
                replayToken={replays.hero}
              >
                <XAxis dataKey="month" />
                <YAxis />
                <Legend isClickable />
                <Tooltip labelKey="month" />
                <Area
                  dataKey="desktop"
                  variant={tweaks.primaryVariant}
                  strokeVariant="dashed"
                  isClickable
                >
                  <ActiveDot variant="colored-border" />
                </Area>
                <Area
                  dataKey="mobile"
                  variant={tweaks.secondaryVariant}
                  isClickable
                >
                  <ActiveDot variant="colored-border" />
                </Area>
              </AreaChart>
            </div>
          </div>
        </header>

        {/* Install */}
        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <h2 className="font-pixel-geist text-lg text-foreground">
              install
            </h2>
            <DitherStrip className="h-1.5 flex-1" />
            <div className="flex items-center gap-1.5">
              {PMS.map((p) => (
                <Pill
                  key={p}
                  label={p}
                  active={pm === p}
                  onClick={() => setPm(p)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                1. register the namespace in{" "}
                <span className="text-foreground">components.json</span>
              </span>
              <CodeBlock code={registries} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                2. add charts — each pulls{" "}
                <span className="text-foreground">@dither-kit/core</span>{" "}
                automatically
              </span>
              <div className="flex flex-col gap-1.5">
                <CopyLine text={addCmd(pm, "@dither-kit/area-chart")} />
                <CopyLine text={addCmd(pm, "@dither-kit/pie-chart")} />
                <CopyLine text={addCmd(pm, "@dither-kit/dither-kit")} />
              </div>
            </div>
          </div>

          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            also available: <span className="text-foreground">bar-chart</span>{" "}
            and <span className="text-foreground">radar-chart</span>.{" "}
            <span className="text-foreground">@dither-kit/dither-kit</span>{" "}
            grabs everything. skipping the namespace config? the raw URL works:{" "}
            <span className="text-foreground">
              shadcn add {HOST}/r/radar-chart.json
            </span>
            . files land in{" "}
            <span className="text-foreground">components/dither-kit/</span>.
          </p>
        </section>

        {/* Credit */}
        <aside className="flex flex-col gap-3">
          <DitherStrip className="h-1.5 w-full" />
          <p className="max-w-2xl text-sm leading-relaxed">
            <span className="font-pixel-geist text-foreground">
              huge thanks to Evil Charts.
            </span>{" "}
            <span className="text-muted-foreground">
              dither-kit exists because of{" "}
              <a
                href="https://www.evilcharts.com"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
              >
                Evil Charts
              </a>{" "}
              by{" "}
              <a
                href="https://github.com/legions-developer/evilcharts"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
              >
                legions-developer
              </a>{" "}
              — the original dithered, composable chart aesthetic that inspired
              every pixel here. Even the per-chart{" "}
              <span className="text-foreground">@namespace/chart</span> install
              flow is theirs. Go star it.
            </span>
          </p>
        </aside>

        {/* Gallery */}
        <div className="flex flex-col gap-14">
          <div className="flex items-center gap-3">
            <h2 className="font-pixel-geist text-lg text-foreground">charts</h2>
            <DitherStrip className="h-1.5 flex-1" />
            <span className="font-mono text-xs text-muted-foreground">
              tweak these charts from the floating dial panel →
            </span>
          </div>

          <Showcase
            title="area"
            install={addCmd(pm, "@dither-kit/area-chart")}
            code={areaCode(tweaks)}
            toolbar={<ReplayButton onClick={() => replay("area")} />}
          >
            <AreaChart
              data={series}
              config={config}
              stackType={tweaks.stacked ? "stacked" : "default"}
              bloom={bloom}
              animationDuration={tweaks.duration}
              replayToken={replays.area}
            >
              <XAxis dataKey="month" />
              <YAxis />
              <Legend isClickable />
              <Tooltip labelKey="month" />
              <Area dataKey="desktop" variant={tweaks.primaryVariant} />
              <Area dataKey="mobile" variant={tweaks.secondaryVariant} />
            </AreaChart>
          </Showcase>

          <Showcase
            title="bar"
            install={addCmd(pm, "@dither-kit/bar-chart")}
            code={barCode(tweaks)}
            toolbar={<ReplayButton onClick={() => replay("bar")} />}
          >
            <BarChart
              data={series}
              config={config}
              stackType={tweaks.stacked ? "stacked" : "default"}
              bloom={bloom}
              animationDuration={tweaks.duration}
              replayToken={replays.bar}
            >
              <XAxis dataKey="month" />
              <YAxis />
              <Legend isClickable />
              <Tooltip labelKey="month" />
              <Bar dataKey="desktop" variant={tweaks.primaryVariant} />
              <Bar dataKey="mobile" variant={tweaks.secondaryVariant} />
            </BarChart>
          </Showcase>

          <Showcase
            title="line"
            install={addCmd(pm, "@dither-kit/area-chart")}
            code={lineCode(tweaks)}
            toolbar={<ReplayButton onClick={() => replay("line")} />}
          >
            <LineChart
              data={series}
              config={config}
              bloom={bloom}
              animationDuration={tweaks.duration}
              replayToken={replays.line}
            >
              <XAxis dataKey="month" />
              <YAxis />
              <Legend isClickable />
              <Tooltip labelKey="month" />
              <Line dataKey="desktop" />
              <Line dataKey="mobile" strokeVariant="dashed" />
            </LineChart>
          </Showcase>

          <div className="grid gap-14 lg:grid-cols-2 lg:gap-8">
            <Showcase
              title="pie"
              install={addCmd(pm, "@dither-kit/pie-chart")}
              code={pieCode(tweaks)}
              tall
              toolbar={<ReplayButton onClick={() => replay("pie")} />}
            >
              <PieChart
                data={pieData}
                config={pieConfig}
                dataKey="visitors"
                nameKey="browser"
                innerRadius={tweaks.donutRadius}
                bloom={bloom}
                animationDuration={tweaks.duration}
                replayToken={replays.pie}
              >
                <Legend isClickable align="center" />
                <Tooltip />
                <Pie variant={tweaks.primaryVariant} />
              </PieChart>
            </Showcase>

            <Showcase
              title="radar"
              install={addCmd(pm, "@dither-kit/radar-chart")}
              code={radarCode(tweaks)}
              tall
              toolbar={<ReplayButton onClick={() => replay("radar")} />}
            >
              <RadarChart
                data={radarData}
                config={config}
                nameKey="skill"
                bloom={bloom}
                animationDuration={tweaks.duration}
                replayToken={replays.radar}
              >
                <Legend isClickable align="center" />
                <Tooltip />
                <Radar dataKey="desktop" variant={tweaks.primaryVariant} />
                <Radar dataKey="mobile" variant={tweaks.secondaryVariant} />
              </RadarChart>
            </Showcase>
          </div>
        </div>

        {/* Props reference */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-pixel-geist text-lg text-foreground">knobs</h2>
            <DitherStrip className="h-1.5 flex-1 self-center" />
          </div>
          <dl className="flex flex-col gap-2.5 font-mono text-xs">
            {PROPS.map(([prop, desc]) => (
              <div
                key={prop}
                className="grid items-baseline gap-1.5 sm:grid-cols-[10rem_1fr] sm:gap-4"
              >
                <dt>
                  <code className="w-fit rounded-md border bg-card px-1.5 py-0.5 text-[11px] text-violet-600 dark:text-violet-400">
                    {prop}
                  </code>
                </dt>
                <dd className="leading-relaxed text-muted-foreground">
                  <Code code={desc} />
                </dd>
              </div>
            ))}
          </dl>
          <CodeBlock code={SPARKLINE_CODE} />
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
          <span className="font-pixel-geist">dither-kit</span>
          <span className="font-mono">
            built on the shoulders of{" "}
            <a
              href="https://www.evilcharts.com"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              Evil Charts
            </a>
          </span>
        </footer>
      </div>

      <DitherStrip className="h-2 w-full" />
      <DialRoot position="top-right" defaultOpen={false} productionEnabled />
    </div>
  )
}

/* ------------------------------------------------------------- snippets */

const stackAttr = (t: Tweaks) => (t.stacked ? ' stackType="stacked"' : "")

const areaCode = (t: Tweaks) =>
  `<AreaChart data={data} config={config}${stackAttr(t)}${bloomAttr(t)}>
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Area dataKey="desktop" variant="${t.primaryVariant}" />
  <Area dataKey="mobile" variant="${t.secondaryVariant}" />
</AreaChart>`

const barCode = (t: Tweaks) =>
  `<BarChart data={data} config={config}${stackAttr(t)}${bloomAttr(t)}>
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Bar dataKey="desktop" variant="${t.primaryVariant}" />
  <Bar dataKey="mobile" variant="${t.secondaryVariant}" />
</BarChart>`

const lineCode = (t: Tweaks) =>
  `// LineChart ships in the area-chart item (line = area + glow)
<LineChart data={data} config={config}${bloomAttr(t)}>
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Line dataKey="desktop" />
  <Line dataKey="mobile" strokeVariant="dashed" />
</LineChart>`

const pieCode = (t: Tweaks) =>
  `<PieChart data={data} config={config}
  dataKey="visitors" nameKey="browser"${
    t.donutRadius > 0 ? ` innerRadius={${t.donutRadius}}` : ""
  }${bloomAttr(t)}>
  <Legend isClickable align="center" />
  <Tooltip />
  <Pie variant="${t.primaryVariant}" />
</PieChart>`

const radarCode = (t: Tweaks) =>
  `<RadarChart data={data} config={config} nameKey="skill"${bloomAttr(t)}>
  <Legend isClickable align="center" />
  <Tooltip />
  <Radar dataKey="desktop" variant="${t.primaryVariant}" />
  <Radar dataKey="mobile" variant="${t.secondaryVariant}" />
</RadarChart>`

const PROPS: [string, string][] = [
  ["variant", '"gradient" | "dotted" | "hatched" | "solid"'],
  [
    "bloom",
    '"off" | "low" | "high" | "aura" | { blur, brightness, opacity, saturate }',
  ],
  ["stackType", '"default" | "stacked" | "percent"'],
  ["colors", "green blue purple pink orange red grey"],
  ["animate", "animationDuration + replayToken for entrance and replay"],
  ["interactive", "false = decorative spark, no crosshair or tooltip"],
]

const SPARKLINE_CODE = `// tiny decorative spark — no axes, no tooltip
<Sparkline data={[3, 7, 5, 9, 8, 12]} color="green" bloom="aura" />`
