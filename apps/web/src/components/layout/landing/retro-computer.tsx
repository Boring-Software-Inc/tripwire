"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkline } from "#/components/dither-kit"

/**
 * A late-80s cream desktop PC (Philips P3120 XT energy) built entirely from
 * CSS — monitor on the system unit with the keyboard attached at its foot.
 * The 4:3 CRT runs a miniature of the tripwire moderation dashboard, and the
 * keyboard's arrow cluster lights up with real key presses — the same presses
 * that flip the landing page into the terminal game.
 *
 * Deliberately flat: hard bevels and plastic seams only. No glows, no blurs.
 */

/* ------------------------------------------------------------- palette */
// The classic beige-box plastics, plus the screen's near-black.
const C = {
  shell: "#d6cfba", // main housing
  shellLight: "#e6e0cc", // top bevels (light source above)
  shellDark: "#b3ab93", // bottom bevels
  shellDeep: "#8f876f", // seams and recesses
  key: "#e2dcc8", // keycap top
  keySide: "#aaa189", // keycap front
  screenBed: "#3a352a", // bezel recess around the tube
  tube: "#14130f", // CRT glass
  accent: "#b03a2e", // the Philips-style red stripe
}

const bevel = (raise = true) => ({
  borderTop: `2px solid ${raise ? C.shellLight : C.shellDeep}`,
  borderLeft: `2px solid ${raise ? C.shellLight : C.shellDeep}`,
  borderRight: `2px solid ${raise ? C.shellDark : C.shellLight}`,
  borderBottom: `2px solid ${raise ? C.shellDark : C.shellLight}`,
})

/* -------------------------------------------------------- demo content */

const DEMO_STATS = [
  {
    label: "pending",
    value: "23",
    color: "red" as const,
    series: [4, 6, 5, 9, 7, 11, 8, 12, 10, 14],
  },
  {
    label: "resolved",
    value: "148",
    color: "blue" as const,
    series: [8, 10, 9, 12, 14, 13, 16, 15, 18, 21],
  },
  {
    label: "automod",
    value: "67",
    color: "purple" as const,
    series: [12, 9, 11, 8, 10, 7, 9, 6, 8, 5],
  },
  {
    label: "banned",
    value: "9",
    color: "orange" as const,
    series: [2, 3, 2, 4, 3, 5, 4, 4, 6, 5],
  },
]

const DEMO_QUEUE = [
  {
    title: "Add comprehensive test coverage",
    meta: "spam · pr #482",
    flag: "#b03a2e",
  },
  { title: "Fix typo in README.md", meta: "bot · pr #479", flag: "#b08a2e" },
  {
    title: "Update dependencies to latest",
    meta: "ai slop · pr #477",
    flag: "#b03a2e",
  },
  {
    title: "Improve error handling logic",
    meta: "spam · issue #93",
    flag: "#b08a2e",
  },
  {
    title: "Refactor utils for better DX",
    meta: "ai slop · pr #474",
    flag: "#b03a2e",
  },
  {
    title: "Add dark mode support",
    meta: "duplicate · issue #91",
    flag: "#b08a2e",
  },
]

/** The moderation dashboard, miniaturized — rendered at full size and scaled
 * down so type and hairlines stay crisp on the tube. */
function DemoScreen() {
  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{ background: "#0d0d0f" }}
    >
      <div
        className="flex origin-top-left flex-col"
        style={{ width: "200%", height: "200%", transform: "scale(0.5)" }}
      >
        {/* topbar */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid #27272a" }}
        >
          <span className="font-mono text-[13px] text-[#eeeeee]">
            tripwire — moderation
          </span>
          <span className="font-mono text-[11px] text-[#6e6e6e]">
            demo.tripwire.sh
          </span>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-4 gap-2 px-4 pt-3">
          {DEMO_STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-1 rounded-md p-2.5"
              style={{ background: "#17171a", border: "1px solid #27272a" }}
            >
              <span className="font-mono text-[10px] text-[#9f9fa9]">
                {s.label}
              </span>
              <span className="font-mono text-[18px] text-[#eeeeee]">
                {s.value}
              </span>
              <div className="h-8">
                <Sparkline data={s.series} color={s.color} animate />
              </div>
            </div>
          ))}
        </div>

        {/* queue */}
        <div className="flex flex-col gap-1.5 px-4 pt-3">
          <span className="font-mono text-[11px] text-[#9f9fa9]">
            pending review
          </span>
          {DEMO_QUEUE.map((q) => (
            <div
              key={q.title}
              className="flex items-center gap-2.5 rounded-md px-3 py-2"
              style={{ background: "#17171a", border: "1px solid #27272a" }}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: q.flag }}
              />
              <span className="truncate font-mono text-[12px] text-[#b4b4b4]">
                {q.title}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-[#6e6e6e]">
                {q.meta}
              </span>
            </div>
          ))}
        </div>

        {/* status line — pinned to the tube's bottom edge */}
        <div
          className="mt-auto flex items-center justify-between px-4 py-1.5"
          style={{ borderTop: "1px solid #27272a" }}
        >
          <span className="font-mono text-[10px] text-[#6e6e6e]">
            5 rules active
          </span>
          <span className="font-mono text-[10px] text-[#67e19f]">
            webhooks connected
          </span>
        </div>
      </div>

      {/* scanlines — plain lines, not a glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </div>
  )
}

/** Mounts the live game canvas as the tube's picture. */
function GameScreen({ canvas }: { canvas: HTMLCanvasElement }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.display = "block"
    el.appendChild(canvas)
    return () => {
      canvas.remove()
    }
  }, [canvas])
  return (
    <div className="absolute inset-0" style={{ background: "#0d0d0f" }}>
      <div ref={host} className="absolute inset-0" />
      {/* same scanlines as the demo — it's the same tube */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------ keyboard */

/** Simplified XT key rows — label only where it matters. */
const KEY_ROWS: string[][] = [
  ["esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "bksp"],
  ["tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["ctrl", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "enter"],
  ["shift", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "shift"],
]

const WIDE_KEYS: Record<string, number> = {
  bksp: 2,
  tab: 1.6,
  "\\": 1.4,
  ctrl: 1.8,
  enter: 2.2,
  shift: 2.4,
}

function Key({
  label = "",
  w = 1,
  pressed = false,
}: {
  label?: string
  w?: number
  pressed?: boolean
}) {
  return (
    <div
      className="flex h-6 items-end justify-center rounded-[3px] pb-0.5 font-mono text-[8px]"
      style={{
        flexGrow: w,
        flexBasis: 0,
        background: pressed ? C.keySide : C.key,
        color: pressed ? C.shellLight : C.shellDeep,
        boxShadow: pressed
          ? `inset 0 2px 0 ${C.shellDeep}`
          : `inset 0 -3px 0 ${C.keySide}, inset 0 1px 0 #f4efdd`,
        transform: pressed ? "translateY(1px)" : "none",
      }}
    >
      {label}
    </div>
  )
}

/** Tracks physically-pressed arrow keys so the drawn cluster mirrors them. */
function usePressedArrows() {
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow")) return
      setPressed((prev) => new Set(prev).add(e.key))
    }
    const up = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow")) return
      setPressed((prev) => {
        const next = new Set(prev)
        next.delete(e.key)
        return next
      })
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])
  return pressed
}

function Keyboard() {
  const pressed = usePressedArrows()
  return (
    <div style={{ perspective: "1000px", perspectiveOrigin: "50% 0%" }}>
      <div
        className="mx-auto w-[84%] rounded-t-[3px] rounded-b-md px-3 pt-2 pb-3"
        style={{
          background: C.shell,
          ...bevel(true),
          borderTop: `2px solid ${C.shellDeep}`, // seam against the case
          borderBottom: `9px solid ${C.shellDark}`, // front edge thickness
          transform: "rotateX(34deg)",
          transformOrigin: "50% 0%",
        }}
      >
        <div className="flex gap-3">
          {/* main key block */}
          <div className="flex flex-1 flex-col gap-1">
            {KEY_ROWS.map((row) => (
              <div key={row.join()} className="flex gap-1">
                {row.map((k, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static layout
                  <Key key={`${k}${i}`} label={k} w={WIDE_KEYS[k] ?? 1} />
                ))}
              </div>
            ))}
            <div className="flex gap-1">
              <Key label="alt" w={1.6} />
              <Key w={7} label="" />
              <Key label="caps" w={1.6} />
            </div>
          </div>

          {/* arrow cluster — mirrors real presses */}
          <div className="flex w-24 shrink-0 flex-col justify-end gap-1">
            <div className="flex justify-center">
              <div className="w-1/3">
                <Key label="↑" pressed={pressed.has("ArrowUp")} />
              </div>
            </div>
            <div className="flex gap-1">
              <Key label="←" pressed={pressed.has("ArrowLeft")} />
              <Key label="↓" pressed={pressed.has("ArrowDown")} />
              <Key label="→" pressed={pressed.has("ArrowRight")} />
            </div>
            <span
              className="pt-0.5 text-center font-mono text-[8px]"
              style={{ color: C.shellDeep }}
            >
              play
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- monitor */

function Monitor({ gameCanvas }: { gameCanvas: HTMLCanvasElement | null }) {
  return (
    <div className="mx-auto w-[76%]">
      {/* housing */}
      <div
        className="rounded-md p-4 pb-3"
        style={{ background: C.shell, ...bevel(true) }}
      >
        {/* recessed bed around the tube */}
        <div
          className="rounded p-2"
          style={{ background: C.screenBed, ...bevel(false) }}
        >
          {/* the tube — 4:3, softly rounded corners like real glass */}
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-[10px]"
            style={{ background: C.tube }}
          >
            {gameCanvas ? <GameScreen canvas={gameCanvas} /> : <DemoScreen />}
          </div>
        </div>
        {/* chin: badge + controls */}
        <div className="flex items-center justify-between pt-2">
          <span
            className="rounded-[2px] px-1.5 py-px font-mono text-[9px]"
            style={{ background: C.shellDark, color: C.shellLight }}
          >
            tripwire
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: C.shellDark }}
            />
            <span
              className="size-2 rounded-full"
              style={{ background: C.shellDark }}
            />
            <span
              className="h-2.5 w-4 rounded-[2px]"
              style={{ background: "#d9a441", ...bevel(true) }}
            />
          </div>
        </div>
      </div>
      {/* neck + foot */}
      <div className="mx-auto h-3 w-24" style={{ background: C.shellDark }} />
      <div
        className="mx-auto h-4 w-40 rounded-b-md"
        style={{ background: C.shell, ...bevel(true) }}
      />
    </div>
  )
}

/* ----------------------------------------------------------- system unit */

function SystemUnit() {
  return (
    <div
      className="relative rounded-md px-4 py-3"
      style={{ background: C.shell, ...bevel(true) }}
    >
      <div className="flex items-center gap-4">
        {/* vent slats + red stripe, Philips-style */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className="h-1 w-16 rounded-full"
              style={{ background: C.accent }}
            />
            <span
              className="font-mono text-[10px]"
              style={{ color: C.shellDeep }}
            >
              p3120
            </span>
          </div>
          <div
            className="h-8 w-full max-w-44 rounded-[2px]"
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, ${C.shellDark} 0px, ${C.shellDark} 2px, ${C.shell} 2px, ${C.shell} 5px)`,
            }}
          />
        </div>

        {/* floppy drives */}
        <div className="flex w-[46%] shrink-0 flex-col gap-1.5">
          {["a", "b"].map((drive) => (
            <div
              key={drive}
              className="flex items-center gap-2 rounded-[3px] px-2 py-1"
              style={{ background: C.shellLight, ...bevel(false) }}
            >
              <span
                className="font-mono text-[8px]"
                style={{ color: C.shellDeep }}
              >
                {drive}
              </span>
              <span
                className="h-1 flex-1 rounded-full"
                style={{ background: C.shellDeep }}
              />
              <span
                className="h-2 w-3 rounded-[1px]"
                style={{ background: C.shellDark }}
              />
            </div>
          ))}
        </div>

        {/* power switch */}
        <div
          className="h-10 w-3 shrink-0 rounded-[2px]"
          style={{ background: "#c4451c", ...bevel(true) }}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- shell */

export function RetroComputer({
  gameCanvas = null,
}: {
  /** When set, the live game replaces the dashboard demo on the CRT. */
  gameCanvas?: HTMLCanvasElement | null
}) {
  return (
    <div className="w-full max-w-3xl select-none">
      <Monitor gameCanvas={gameCanvas} />
      <SystemUnit />
      <Keyboard />
      <p className="pt-4 text-center font-mono text-[11px] text-tw-text-muted">
        {gameCanvas
          ? "arrows move, space shoots, esc hands the machine back"
          : "press an arrow key to play"}
      </p>
    </div>
  )
}
