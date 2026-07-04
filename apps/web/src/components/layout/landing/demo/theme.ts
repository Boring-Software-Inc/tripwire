/**
 * modkit's two palettes, resolved to hex from its oklch tokens and exposed as
 * CSS custom properties scoped to the demo root — the tube gets a real theme
 * toggle without touching anything outside the glass.
 */

export type DemoTheme = "dark" | "light"

type Palette = {
  bg: string
  card: string
  fg: string
  fg2: string // muted-foreground
  muted: string // row hover/active + sheet bg
  border: string
  surface0: string
  surface1: string
  surface2: string
  primary: string
  primaryFg: string
}

const DARK: Palette = {
  bg: "#09090b",
  card: "#18181b",
  fg: "#fafafa",
  fg2: "#a1a1aa",
  muted: "#111113",
  border: "#27272a",
  surface0: "#1f1f23",
  surface1: "#232327",
  surface2: "#2b2b30",
  primary: "#fafafa",
  primaryFg: "#18181b",
}

const LIGHT: Palette = {
  bg: "#ffffff",
  card: "#ffffff",
  fg: "#09090b",
  fg2: "#71717a",
  muted: "#f4f4f5",
  border: "#e4e4e7",
  surface0: "#ececee",
  surface1: "#f4f4f5",
  surface2: "#e6e6e9",
  primary: "#18181b",
  primaryFg: "#fafafa",
}

/** CSS custom properties for the demo root. Components read `var(--d-*)`. */
export function themeVars(theme: DemoTheme): Record<string, string> {
  const p = theme === "dark" ? DARK : LIGHT
  return {
    "--d-bg": p.bg,
    "--d-card": p.card,
    "--d-fg": p.fg,
    "--d-fg2": p.fg2,
    "--d-muted": p.muted,
    "--d-border": p.border,
    "--d-surface0": p.surface0,
    "--d-surface1": p.surface1,
    "--d-surface2": p.surface2,
    "--d-primary": p.primary,
    "--d-primary-fg": p.primaryFg,
  }
}

// Fixed accents (same in both themes, like the app's tailwind colors).
export const ACCENT = {
  good: "#10b981", // emerald-500
  bad: "#ef4444", // red-500
  amber: "#f59e0b",
  emerald600: "#059669",
  red600: "#dc2626",
  emerald400: "#34d399",
} as const

/** Shorthand for var() lookups in inline styles. */
export const V = {
  bg: "var(--d-bg)",
  card: "var(--d-card)",
  fg: "var(--d-fg)",
  fg2: "var(--d-fg2)",
  muted: "var(--d-muted)",
  border: "var(--d-border)",
  surface0: "var(--d-surface0)",
  surface1: "var(--d-surface1)",
  surface2: "var(--d-surface2)",
  primary: "var(--d-primary)",
  primaryFg: "var(--d-primary-fg)",
} as const
