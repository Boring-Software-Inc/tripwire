"use client"

import { MoonIcon, SparklesIcon, SunIcon } from "lucide-react"
import {
  ActiveDot,
  Area,
  AreaChart,
  Bar,
  BarChart,
  type BloomInput,
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
import {
  addCmd,
  areaCode,
  barCode,
  config,
  lineCode,
  pieCode,
  pieConfig,
  pieData,
  REGISTRY_URL,
  REPO,
  type Pm,
  PMS,
  PROPS,
  radarCode,
  radarData,
  series,
  SETUP_PROMPT,
  SPARKLINE_CODE,
  type Tweaks,
} from "./content"
import {
  Code,
  CodeBlock,
  CopyButton,
  CopyLine,
  DitherStrip,
  OrDivider,
  Pill,
  ReplayButton,
  Showcase,
} from "./ui"

/** The docs page, section by section — the route composes these. */

export type Replays = {
  hero: number
  area: number
  bar: number
  line: number
  pie: number
  radar: number
}
export type ReplayKey = keyof Replays

export function HeroSection({
  light,
  onToggleTheme,
  tweaks,
  bloom,
  replayToken,
  onReplay,
}: {
  light: boolean
  onToggleTheme: () => void
  tweaks: Tweaks
  bloom: BloomInput
  replayToken: number
  onReplay: () => void
}) {
  return (
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
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          onClick={onToggleTheme}
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
        with a recharts-style children-as-config API. Ordered-dither fills that
        hold up in light and dark, entrance animations, a gliding scrub tooltip,
        selection, winking sparkles, and colour bloom.
      </p>

      {/* Hero chart */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            scrub it, hover a legend entry to spotlight that series, click to
            lock it
          </span>
          <ReplayButton onClick={onReplay} />
        </div>
        <div className="h-72">
          <AreaChart
            data={series}
            config={config}
            stackType={tweaks.stacked ? "stacked" : "default"}
            bloom={bloom}
            animationDuration={tweaks.duration}
            replayToken={replayToken}
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
  )
}

export function InstallSection({
  pm,
  onPmChange,
}: {
  pm: Pm
  onPmChange: (pm: Pm) => void
}) {
  // Optional prettier path: register the namespace, then install by @name.
  const registries = `// components.json\n{\n  "registries": {\n    "@dither-kit": "${REGISTRY_URL}"\n  }\n}`
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h2 className="font-pixel-geist text-lg text-foreground">install</h2>
        <DitherStrip className="h-1.5 flex-1" />
        <div className="flex items-center gap-1.5">
          {PMS.map((p) => (
            <Pill
              key={p}
              label={p}
              active={pm === p}
              onClick={() => onPmChange(p)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          add a chart — no config, pulls{" "}
          <span className="text-foreground">core</span> and its deps
          automatically
        </span>
        <div className="flex flex-col gap-1.5">
          <CopyLine text={addCmd(pm, `${REPO}/area-chart`)} />
          <CopyLine text={addCmd(pm, `${REPO}/pie-chart`)} />
          <CopyLine text={addCmd(pm, `${REPO}/dither-kit`)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <OrDivider />
        <CopyButton
          text={SETUP_PROMPT}
          label="copy setup prompt"
          icon={<SparklesIcon className="size-3.5" />}
        />
        <span className="text-center font-mono text-[11px] text-muted-foreground">
          paste into Claude Code, Cursor, or any agent to install + wire up a
          chart
        </span>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        also available: <span className="text-foreground">bar-chart</span>,{" "}
        <span className="text-foreground">radar-chart</span>, and{" "}
        <span className="text-foreground">core</span>.{" "}
        <span className="text-foreground">{REPO}/dither-kit</span> grabs
        everything. files land in{" "}
        <span className="text-foreground">components/dither-kit/</span>.
      </p>

      <details className="group flex flex-col gap-2">
        <summary className="cursor-pointer font-mono text-xs text-muted-foreground marker:content-['']">
          <span className="text-foreground group-open:hidden">
            + prefer the @dither-kit namespace?
          </span>
          <span className="hidden text-foreground group-open:inline">
            − use the @dither-kit namespace
          </span>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <span className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            register it once in{" "}
            <span className="text-foreground">components.json</span>, then add
            by <span className="text-foreground">@name</span>:
          </span>
          <CodeBlock code={registries} />
          <CopyLine text={addCmd(pm, "@dither-kit/area-chart")} />
        </div>
      </details>
    </section>
  )
}

export function ChartGallery({
  pm,
  tweaks,
  bloom,
  replays,
  onReplay,
}: {
  pm: Pm
  tweaks: Tweaks
  bloom: BloomInput
  replays: Replays
  onReplay: (key: ReplayKey) => void
}) {
  return (
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
        install={addCmd(pm, `${REPO}/area-chart`)}
        code={areaCode(tweaks)}
        toolbar={<ReplayButton onClick={() => onReplay("area")} />}
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
        install={addCmd(pm, `${REPO}/bar-chart`)}
        code={barCode(tweaks)}
        toolbar={<ReplayButton onClick={() => onReplay("bar")} />}
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
        install={addCmd(pm, `${REPO}/area-chart`)}
        code={lineCode(tweaks)}
        toolbar={<ReplayButton onClick={() => onReplay("line")} />}
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
          install={addCmd(pm, `${REPO}/pie-chart`)}
          code={pieCode(tweaks)}
          tall
          toolbar={<ReplayButton onClick={() => onReplay("pie")} />}
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
          install={addCmd(pm, `${REPO}/radar-chart`)}
          code={radarCode(tweaks)}
          tall
          toolbar={<ReplayButton onClick={() => onReplay("radar")} />}
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
  )
}

export function KnobsSection() {
  return (
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
  )
}

export function DocsFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
      <span className="font-pixel-geist">dither-kit</span>
      <span className="font-mono">
        built on the shoulders of{" "}
        <a
          href="https://evilcharts.com/"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          Evil Charts
        </a>
      </span>
    </footer>
  )
}
