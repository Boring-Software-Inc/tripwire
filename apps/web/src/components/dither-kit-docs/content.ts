import type {
  AreaVariant,
  BloomInput,
  ChartConfig,
} from "#/components/dither-kit"

/** Everything the dither-kit docs page renders from: install commands, demo
 * data, the tweak model, and the live code snippets. */

/** Where the registry lives once deployed. */
export const HOST = "https://tripwire.sh"

/** GitHub repo backing the zero-config shadcn shorthand (`add <REPO>/<item>`). */
export const REPO = "Boring-Software-Inc/tripwire"

/* ------------------------------------------------------- package manager */

export const PMS = ["npm", "pnpm", "yarn", "bun"] as const
export type Pm = (typeof PMS)[number]

/** The runner each package manager uses for one-off CLIs. */
const PM_RUNNER: Record<Pm, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
  bun: "bunx --bun",
}

export const addCmd = (pm: Pm, item: string): string =>
  `${PM_RUNNER[pm]} shadcn@latest add ${item}`

/** Paste-into-your-AI setup prompt — install command + the non-obvious API
 * shape (the config label/color object) + one worked example. Deliberately
 * tells the assistant not to scaffold a whole page. */
export const SETUP_PROMPT = `Set up dither-kit — composable dithered charts for shadcn/ui — in this project.

Install with the shadcn CLI (this also pulls the shared \`core\` engine + its deps like motion and d3):
  npx shadcn@latest add ${REPO}/area-chart

Files land in components/dither-kit/. The API is recharts-style / children-as-config — a data array plus a config object that maps each series to a label and colour:

  import { AreaChart, Area, XAxis, YAxis, Legend, Tooltip } from "@/components/dither-kit/area-chart"

  const data = [{ month: "Jan", desktop: 186 }, { month: "Feb", desktop: 240 }]
  const config = { desktop: { label: "Desktop", color: "blue" } }

  <AreaChart data={data} config={config} bloom="aura">
    <XAxis dataKey="month" />
    <YAxis />
    <Legend isClickable />
    <Tooltip labelKey="month" />
    <Area dataKey="desktop" variant="gradient" />
  </AreaChart>

Other charts install the same way: bar-chart, pie-chart, radar-chart (or ${REPO}/dither-kit for all of them).
- variant: gradient | dotted | hatched | solid
- color: green blue purple pink orange red grey
- bloom: off | low | high | aura

Add one chart where it fits what I'm building. Keep it minimal — don't scaffold a new page or demo unless I ask.`

/* ------------------------------------------------------------------ data */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]
export const series = MONTHS.map((month, i) => ({
  month,
  desktop: Math.round(120 + 90 * Math.sin(i * 0.7) + i * 14),
  mobile: Math.round(70 + 50 * Math.cos(i * 0.5) + i * 8),
}))
export const config: ChartConfig = {
  desktop: { label: "Desktop", color: "blue" },
  mobile: { label: "Mobile", color: "purple" },
}
export const pieData = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 120 },
  { browser: "other", visitors: 90 },
]
export const pieConfig: ChartConfig = {
  chrome: { label: "Chrome", color: "blue" },
  safari: { label: "Safari", color: "green" },
  firefox: { label: "Firefox", color: "orange" },
  edge: { label: "Edge", color: "purple" },
  other: { label: "Other", color: "grey" },
}
export const radarData = [
  { skill: "Speed", desktop: 186, mobile: 120 },
  { skill: "Power", desktop: 205, mobile: 98 },
  { skill: "Range", desktop: 137, mobile: 160 },
  { skill: "Defense", desktop: 173, mobile: 125 },
  { skill: "Magic", desktop: 160, mobile: 190 },
  { skill: "Luck", desktop: 144, mobile: 110 },
]

/* ---------------------------------------------------------- live tweaks */

export const VARIANTS: AreaVariant[] = [
  "gradient",
  "dotted",
  "hatched",
  "solid",
]
export const BLOOM_PRESETS = ["off", "low", "high", "aura", "custom"] as const
export type BloomPreset = (typeof BLOOM_PRESETS)[number]

export type Tweaks = {
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

export function bloomOf(t: Tweaks): BloomInput {
  return t.bloomPreset === "custom"
    ? {
        blur: t.blur,
        brightness: t.brightness,
        opacity: t.opacity,
        saturate: t.saturate,
      }
    : t.bloomPreset
}

/* ------------------------------------------------------------- snippets */

/** How the current bloom reads in the code snippets. */
function bloomAttr(t: Tweaks): string {
  if (t.bloomPreset === "custom") {
    return ` bloom={{ blur: ${t.blur}, brightness: ${t.brightness}, opacity: ${t.opacity}, saturate: ${t.saturate} }}`
  }
  return t.bloomPreset === "off" ? "" : ` bloom="${t.bloomPreset}"`
}

const stackAttr = (t: Tweaks): string =>
  t.stacked ? ' stackType="stacked"' : ""

/** Non-default entrance timing shows up in the copied code too. */
const durationAttr = (t: Tweaks): string =>
  t.duration === 900 ? "" : ` animationDuration={${t.duration}}`

export const areaCode = (t: Tweaks): string =>
  `<AreaChart data={data} config={config}${stackAttr(t)}${bloomAttr(t)}${durationAttr(t)}>
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Area dataKey="desktop" variant="${t.primaryVariant}" />
  <Area dataKey="mobile" variant="${t.secondaryVariant}" />
</AreaChart>`

export const barCode = (t: Tweaks): string =>
  `<BarChart data={data} config={config}${stackAttr(t)}${bloomAttr(t)}${durationAttr(t)}>
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Bar dataKey="desktop" variant="${t.primaryVariant}" />
  <Bar dataKey="mobile" variant="${t.secondaryVariant}" />
</BarChart>`

export const lineCode = (t: Tweaks): string =>
  `// LineChart ships in the area-chart item (line = area + glow)
<LineChart data={data} config={config}${bloomAttr(t)}${durationAttr(t)}>
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Line dataKey="desktop" />
  <Line dataKey="mobile" strokeVariant="dashed" />
</LineChart>`

export const pieCode = (t: Tweaks): string =>
  `<PieChart data={data} config={config}
  dataKey="visitors" nameKey="browser"${
    t.donutRadius > 0 ? ` innerRadius={${t.donutRadius}}` : ""
  }${bloomAttr(t)}${durationAttr(t)}>
  <Legend isClickable align="center" />
  <Tooltip />
  <Pie variant="${t.primaryVariant}" />
</PieChart>`

export const radarCode = (t: Tweaks): string =>
  `<RadarChart data={data} config={config} nameKey="skill"${bloomAttr(t)}${durationAttr(t)}>
  <Legend isClickable align="center" />
  <Tooltip />
  <Radar dataKey="desktop" variant="${t.primaryVariant}" />
  <Radar dataKey="mobile" variant="${t.secondaryVariant}" />
</RadarChart>`

export const PROPS: [string, string][] = [
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

export const SPARKLINE_CODE = `// tiny decorative spark — no axes, no tooltip
<Sparkline data={[3, 7, 5, 9, 8, 12]} color="green" bloom="aura" />`
