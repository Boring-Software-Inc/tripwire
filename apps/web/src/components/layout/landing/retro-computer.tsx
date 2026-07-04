"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { DemoScreen } from "./demo-screen"

/**
 * A late-80s cream desktop PC (Philips P3120 XT energy) built entirely from
 * CSS. At rest only the system unit sits at the bottom of the page; its power
 * button boots the machine — the monitor rises out of the case, the screen
 * warms up onto a miniature of the tripwire moderation dashboard, and the
 * keyboard slides out from underneath. Every drawn key mirrors the real
 * keyboard, and the arrow keys boot the game straight onto the CRT.
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
  led: "#67e19f", // power light
}

const bevel = (raise = true) => ({
  borderTop: `2px solid ${raise ? C.shellLight : C.shellDeep}`,
  borderLeft: `2px solid ${raise ? C.shellLight : C.shellDeep}`,
  borderRight: `2px solid ${raise ? C.shellDark : C.shellLight}`,
  borderBottom: `2px solid ${raise ? C.shellDark : C.shellLight}`,
})

// One spring for the whole boot choreography — snappy with a hint of mass.
const POP = { type: "spring", visualDuration: 0.55, bounce: 0.18 } as const

/* -------------------------------------------------------- demo content */

const SCANLINES = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
} as const

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
        style={SCANLINES}
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

/** Physical key → drawn keycap label, for everything the board draws. */
function labelOfKey(e: KeyboardEvent): string {
  const named: Record<string, string> = {
    Escape: "esc",
    Backspace: "bksp",
    Tab: "tab",
    Control: "ctrl",
    Enter: "enter",
    Shift: "shift",
    Alt: "alt",
    CapsLock: "caps",
    " ": "space",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
  }
  return named[e.key] ?? e.key.toLowerCase()
}

/** Tracks every physically-pressed key so the whole drawn board mirrors the
 * real one — type anywhere and the machine types with you. */
function usePressedKeys() {
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      setPressed((prev) => new Set(prev).add(labelOfKey(e)))
    }
    const up = (e: KeyboardEvent) => {
      setPressed((prev) => {
        const next = new Set(prev)
        next.delete(labelOfKey(e))
        return next
      })
    }
    // Keys held while the window loses focus would stick down forever.
    const clear = () => setPressed(new Set())
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", clear)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", clear)
    }
  }, [])
  return pressed
}

function Keyboard() {
  const pressed = usePressedKeys()
  return (
    // Lies flat on the desk: the deck tilts away from the viewer so the far
    // edge (at the case) is narrower than the near edge — like a real board.
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
          {/* main key block — every cap mirrors the physical board */}
          <div className="flex flex-1 flex-col gap-1">
            {KEY_ROWS.map((row) => (
              <div key={row.join()} className="flex gap-1">
                {row.map((k, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static layout
                  <Key
                    key={`${k}${i}`}
                    label={k}
                    w={WIDE_KEYS[k] ?? 1}
                    pressed={pressed.has(k)}
                  />
                ))}
              </div>
            ))}
            <div className="flex gap-1">
              <Key label="alt" w={1.6} pressed={pressed.has("alt")} />
              <Key w={7} label="" pressed={pressed.has("space")} />
              <Key label="caps" w={1.6} pressed={pressed.has("caps")} />
            </div>
          </div>

          {/* arrow cluster */}
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

function Monitor({
  gameCanvas,
  onDemoEngagement,
}: {
  gameCanvas: HTMLCanvasElement | null
  onDemoEngagement?: (engaged: boolean) => void
}) {
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
            {/* the picture warms in a beat after the tube arrives */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.4 }}
            >
              {gameCanvas ? (
                <GameScreen canvas={gameCanvas} />
              ) : (
                <DemoScreen onEngagement={onDemoEngagement} />
              )}
            </motion.div>
          </div>
        </div>
        {/* chin: moulded brand, model sticker, controls, power light */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            {/* brand moulded into the plastic — debossed, not printed */}
            <span
              className="font-sans text-[10px] font-semibold"
              style={{
                color: C.shellDark,
                textShadow: "0 1px 0 rgba(255,255,255,0.55)",
              }}
            >
              tripwire
            </span>
            {/* the little metallic model plate every CRT carried */}
            <span
              className="rounded-[1px] px-1 py-px font-mono text-[7px]"
              style={{
                background: "#c9c4b4",
                color: "#5d5747",
                border: `1px solid ${C.shellDeep}`,
              }}
            >
              cm 1431
            </span>
          </div>
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
            {/* tube power light */}
            <span
              className="ml-0.5 size-1.5 rounded-full"
              style={{ background: C.led, border: `1px solid ${C.shellDeep}` }}
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

function SystemUnit({
  powered,
  onPowerToggle,
}: {
  powered: boolean
  onPowerToggle: () => void
}) {
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

        {/* drive bays — slot, activity light, eject. no labels, like the
            real thing */}
        <div className="flex w-[42%] shrink-0 flex-col gap-1.5">
          {["upper", "lower"].map((bay) => (
            <div
              key={bay}
              className="flex items-center gap-2 rounded-[3px] px-2 py-1"
              style={{ background: C.shellLight, ...bevel(false) }}
            >
              <span
                className="h-1 flex-1 rounded-full"
                style={{ background: C.shellDeep }}
              />
              <span
                className="size-1 rounded-full"
                style={{ background: "#7a3b34" }}
              />
              <span
                className="h-2 w-3 rounded-[1px]"
                style={{ background: C.shellDark, ...bevel(true) }}
              />
            </div>
          ))}
        </div>

        {/* power button + LED — the machine's one real control */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span
            className="size-1.5 rounded-full"
            style={{
              background: powered ? C.led : C.shellDark,
              border: `1px solid ${C.shellDeep}`,
            }}
          />
          {/* plain moulded push button — latched in while the machine runs */}
          <button
            type="button"
            aria-pressed={powered}
            aria-label={powered ? "Power off" : "Power on"}
            onClick={onPowerToggle}
            className="h-8 w-9 cursor-pointer rounded-[3px] transition-transform active:translate-y-px"
            style={{
              background: powered ? C.shellDark : C.shell,
              ...bevel(!powered),
            }}
          />
          <span className="font-mono text-[8px]" style={{ color: C.shellDeep }}>
            power
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- shell */

export function RetroComputer({
  powered,
  onPowerToggle,
  gameCanvas = null,
  onDemoEngagement,
}: {
  powered: boolean
  onPowerToggle: () => void
  /** When set, the live game replaces the dashboard demo on the CRT. */
  gameCanvas?: HTMLCanvasElement | null
  /** Fires when the visitor's mouse takes / releases the demo screen. */
  onDemoEngagement?: (engaged: boolean) => void
}) {
  return (
    <div className="w-full max-w-4xl select-none">
      {/* monitor rises out of the case top */}
      <motion.div
        className="relative z-0 overflow-hidden"
        initial={false}
        animate={
          powered
            ? { height: "auto", y: 0, opacity: 1 }
            : { height: 0, y: 56, opacity: 0 }
        }
        transition={POP}
      >
        <Monitor gameCanvas={gameCanvas} onDemoEngagement={onDemoEngagement} />
      </motion.div>

      <div className="relative z-10">
        <SystemUnit powered={powered} onPowerToggle={onPowerToggle} />
      </div>

      {/* keyboard slides out from under the case, a beat behind the monitor */}
      <motion.div
        className="relative z-0 overflow-hidden"
        initial={false}
        animate={
          powered
            ? { height: "auto", y: 0, opacity: 1 }
            : { height: 0, y: -48, opacity: 0 }
        }
        transition={{ ...POP, delay: powered ? 0.14 : 0 }}
      >
        <Keyboard />
        <p className="pt-4 pb-1 text-center font-mono text-[11px] text-white/80">
          {gameCanvas
            ? "arrows move, space shoots, esc hands the machine back"
            : "press an arrow key to play"}
        </p>
      </motion.div>
    </div>
  )
}
