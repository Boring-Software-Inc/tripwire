"use client"

import { Mesh, Program, Renderer, Texture, Triangle } from "ogl"
import { useEffect, useRef } from "react"
import {
  TRIPWIRE_EYE_OUTER_PATH,
  TRIPWIRE_EYE_OUTER_VIEWBOX,
  TRIPWIRE_EYE_PUPIL_PATH,
  TRIPWIRE_EYE_PUPIL_RECT_IN_OUTER,
  TRIPWIRE_EYE_PUPIL_VIEWBOX,
  TRIPWIRE_EYE_SOCKET_PATH,
  TRIPWIRE_EYE_SOCKET_RECT_IN_OUTER,
  TRIPWIRE_EYE_SOCKET_VIEWBOX,
} from "@tripwire/ui/icons/tripwire-eye"

/**
 * The tripwire eye as a cumulus cloud drifting in the Bliss sky, following
 * the cursor. The eye silhouette is rasterized into a blurred density field
 * and re-shaped every frame by domain-warped fbm noise, so the edges billow
 * and wisp like the real thing.
 *
 * How the cloud look is built (each maps to a real cloud property):
 * - shape: cumulus = rounded billows. The blurred mask is sampled through a
 *   noise warp, so the silhouette bulges and cauliflowers instead of showing
 *   a hard logo stamp.
 * - edges: alpha is a smoothstep over density — soft but defined boundaries,
 *   with low-density wisps eroding off the fringe.
 * - lighting: clouds are lit by scattering. Density is compared against a
 *   sample nudged toward the sun (upper-left in Bliss): thick-above points
 *   fall into self-shadow toward a gray-blue base, thin sunward edges pick up
 *   a silver lining.
 * - motion: the noise field advects slowly with time (internal churn) and a
 *   wind vector fed by cursor velocity skews the warp, so the cloud drags and
 *   stretches while it travels, then relaxes when it settles.
 *
 * The pupil is its own density blob that leans toward the live cursor inside
 * the socket, so the cloud still *looks at* your pointer.
 */

const EYE_ASPECT = TRIPWIRE_EYE_OUTER_VIEWBOX[1] / TRIPWIRE_EYE_OUTER_VIEWBOX[0]
// The eye is drawn at this fraction of its texture so warped samples stay
// inside the bitmap (padding for the billow amplitude).
const PAD_SCALE = 0.62

const vertex = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;   // device px
uniform vec2 uMouse;        // device px, smoothed, y-up
uniform vec2 uWind;         // smoothed cursor velocity, roughly -1..1
uniform vec2 uPupil;        // pupil lean inside the socket, uv units
uniform float uEyeW;        // eye quad width in device px
uniform sampler2D uBody;    // blurred eye body (outer minus socket)
uniform sampler2D uPupilTex;// blurred pupil, same texture space

varying vec2 vUv;

// -- value noise + fbm ------------------------------------------------
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8); // rotate octaves to hide the grid
  for (int i = 0; i < 5; i++) {
    v += amp * vnoise(p);
    p = rot * p * 2.0;
    amp *= 0.5;
  }
  return v;
}

// -- the cloud's density field ----------------------------------------
float density(vec2 uv) {
  // internal churn: two warp fields scrolling at different rates gives the
  // slow tumbling parallax of a real cumulus
  vec2 q = vec2(
    fbm(uv * 2.2 + vec2(0.0, uTime * 0.10)),
    fbm(uv * 2.2 + vec2(5.2, uTime * 0.13))
  );
  vec2 warp = (q - 0.5) * 0.30;
  // fine crinkle on top of the big lobes
  warp += (vec2(
    fbm(uv * 7.0 + vec2(uTime * 0.20, 3.1)),
    fbm(uv * 7.0 + vec2(8.4, uTime * 0.17))
  ) - 0.5) * 0.045;

  // wind drag: samples shift against travel, more on the trailing half, so
  // the cloud stretches behind its own motion
  warp -= uWind * (0.35 + 0.55 * q.y) * 0.18;

  vec2 p = uv + warp;
  float body = texture2D(uBody, p).r;
  // the pupil leans toward the live cursor but billows with the same warp
  float pupil = texture2D(uPupilTex, p - uPupil).r;
  float d = (body + pupil) * 1.35;

  // cauliflower lobes: ridged fbm modulates thickness so the surface reads
  // as clustered billows rather than one smooth blob
  float ridged = 1.0 - abs(2.0 * fbm(uv * 5.0 + vec2(uTime * 0.05, -uTime * 0.04)) - 1.0);
  d *= 0.78 + 0.32 * ridged;

  // fringe erosion: a low-frequency field carves detached wisps at the edge
  float erode = fbm(uv * 2.0 - vec2(uTime * 0.03, 0.0));
  d -= smoothstep(0.55, 1.0, erode) * 0.12;

  return d;
}

void main() {
  // place the eye quad at the (smoothed) cursor
  vec2 halfSize = vec2(uEyeW, uEyeW * ${EYE_ASPECT.toFixed(4)}) * 0.5;
  vec2 uv = (gl_FragCoord.xy - uMouse) / (halfSize * 2.0) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  // texture y runs down, screen y runs up
  uv.y = 1.0 - uv.y;

  float d = density(uv);
  float alpha = smoothstep(0.35, 0.54, d);
  if (alpha < 0.003) discard;

  // scattering: if the cloud thickens toward the sun the point is buried
  // (self-shadow); if it thins, we're on the sunlit surface
  vec2 sunDir = normalize(vec2(-0.45, -0.70)) * 0.05; // upper-left, tex space
  float dSun = density(uv + sunDir);
  // mostly sunlit white; self-shadow only where density really piles up
  float lit = clamp(0.74 + (d - dSun) * 1.8, 0.0, 1.0);
  // undersides sit in their own shadow (texture y runs down)
  lit *= 1.0 - 0.24 * smoothstep(0.45, 0.95, uv.y);

  vec3 baseGray = vec3(0.78, 0.81, 0.86); // sky-ambient shade, not charcoal
  vec3 sunWhite = vec3(1.0);
  vec3 col = mix(baseGray, sunWhite, lit);

  // cottony surface mottle — tiny brightness grain, the cauliflower texture
  col *= 0.95 + 0.09 * fbm(uv * 8.0 + vec2(uTime * 0.06, -uTime * 0.04));

  // silver lining: thin sun-facing fringe transmits light
  float rim = smoothstep(0.32, 0.44, d) * (1.0 - smoothstep(0.44, 0.68, d));
  col += rim * 0.10;

  gl_FragColor = vec4(min(col, vec3(1.0)), alpha * 0.97);
}
`

/** Rasterize SVG path layers into a padded, blurred density texture. */
function rasterizeMask(
  layers: {
    path: string
    viewBox: readonly [number, number]
    rect: readonly [number, number, number, number]
    mode: "add" | "subtract"
  }[],
  blurPx: number
) {
  const [vbW, vbH] = TRIPWIRE_EYE_OUTER_VIEWBOX
  const w = 512
  const h = Math.round((w * vbH) / vbW)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  // draw at PAD_SCALE around the centre so billows never sample off-texture
  const sx = (w / vbW) * PAD_SCALE
  const sy = (h / vbH) * PAD_SCALE
  const ox = (w * (1 - PAD_SCALE)) / 2
  const oy = (h * (1 - PAD_SCALE)) / 2
  ctx.filter = `blur(${blurPx}px)`
  for (const layer of layers) {
    ctx.save()
    ctx.globalCompositeOperation =
      layer.mode === "add" ? "source-over" : "destination-out"
    ctx.fillStyle = "white"
    const [rx, ry, rw, rh] = layer.rect
    const [pw, ph] = layer.viewBox
    ctx.translate(ox + rx * sx, oy + ry * sy)
    ctx.scale((rw / pw) * sx, (rh / ph) * sy)
    ctx.fill(new Path2D(layer.path))
    ctx.restore()
  }
  // the shader reads .r — flatten alpha into luminance on black
  const flat = document.createElement("canvas")
  flat.width = w
  flat.height = h
  const fctx = flat.getContext("2d")
  if (!fctx) return canvas
  fctx.fillStyle = "black"
  fctx.fillRect(0, 0, w, h)
  fctx.drawImage(canvas, 0, 0)
  return flat
}

export function CloudEye({ size = 300 }: { size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)

    const bodyCanvas = rasterizeMask(
      [
        {
          path: TRIPWIRE_EYE_OUTER_PATH,
          viewBox: TRIPWIRE_EYE_OUTER_VIEWBOX,
          rect: [
            0,
            0,
            TRIPWIRE_EYE_OUTER_VIEWBOX[0],
            TRIPWIRE_EYE_OUTER_VIEWBOX[1],
          ],
          mode: "add",
        },
        {
          path: TRIPWIRE_EYE_SOCKET_PATH,
          viewBox: TRIPWIRE_EYE_SOCKET_VIEWBOX,
          rect: TRIPWIRE_EYE_SOCKET_RECT_IN_OUTER,
          mode: "subtract",
        },
      ],
      13
    )
    const pupilCanvas = rasterizeMask(
      [
        {
          path: TRIPWIRE_EYE_PUPIL_PATH,
          viewBox: TRIPWIRE_EYE_PUPIL_VIEWBOX,
          rect: TRIPWIRE_EYE_PUPIL_RECT_IN_OUTER,
          mode: "add",
        },
      ],
      7
    )
    const texOpts = { generateMipmaps: false } as const
    const bodyTex = new Texture(gl, { image: bodyCanvas, ...texOpts })
    const pupilTex = new Texture(gl, { image: pupilCanvas, ...texOpts })

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([1, 1]) },
        uMouse: { value: new Float32Array([0, 0]) },
        uWind: { value: new Float32Array([0, 0]) },
        uPupil: { value: new Float32Array([0, 0]) },
        uEyeW: { value: size * dpr },
        uBody: { value: bodyTex },
        uPupilTex: { value: pupilTex },
      },
    })
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })
    container.appendChild(gl.canvas)
    gl.canvas.style.width = "100%"
    gl.canvas.style.height = "100%"
    gl.canvas.style.display = "block"

    const resize = () => {
      renderer.dpr = dpr
      renderer.setSize(container.offsetWidth, container.offsetHeight)
      const res = program.uniforms.uResolution.value as Float32Array
      res[0] = gl.canvas.width
      res[1] = gl.canvas.height
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    // raw + smoothed cursor, in device px with y up (gl_FragCoord space)
    const raw = {
      x: container.offsetWidth * 0.5 * dpr,
      y: container.offsetHeight * 0.62 * dpr,
    }
    const smooth = { x: raw.x, y: raw.y }
    const wind = { x: 0, y: 0 }
    const pupil = { x: 0, y: 0 }

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      raw.x = (e.clientX - rect.left) * dpr
      raw.y = (rect.height - (e.clientY - rect.top)) * dpr
    }
    window.addEventListener("mousemove", onMove)

    let raf = 0
    const update = (t: number) => {
      raf = requestAnimationFrame(update)
      const time = t * 0.001

      // idle drift so the cloud never sits frozen in the sky
      const driftX = Math.sin(time * 0.4) * 10 * dpr
      const driftY = Math.cos(time * 0.27) * 7 * dpr

      const prevX = smooth.x
      const prevY = smooth.y
      smooth.x += (raw.x + driftX - smooth.x) * 0.055
      smooth.y += (raw.y + driftY - smooth.y) * 0.055

      // wind = smoothed velocity; eased again so gusts decay naturally
      const vx = (smooth.x - prevX) / dpr
      const vy = (smooth.y - prevY) / dpr
      wind.x += (Math.max(-1, Math.min(1, vx * 0.12)) - wind.x) * 0.06
      wind.y += (Math.max(-1, Math.min(1, vy * 0.12)) - wind.y) * 0.06

      // the pupil leans toward where the live cursor actually is
      const lookX = (raw.x - smooth.x) / (size * dpr)
      const lookY = (raw.y - smooth.y) / (size * dpr)
      const lookLen = Math.hypot(lookX, lookY) || 1
      const capped = Math.min(lookLen, 0.35)
      pupil.x += ((lookX / lookLen) * capped * 0.13 - pupil.x) * 0.08
      // texture y is flipped relative to screen y
      pupil.y += (-(lookY / lookLen) * capped * 0.13 - pupil.y) * 0.08

      program.uniforms.uTime.value = time
      const mu = program.uniforms.uMouse.value as Float32Array
      mu[0] = smooth.x
      mu[1] = smooth.y
      const wu = program.uniforms.uWind.value as Float32Array
      wu[0] = wind.x
      wu[1] = wind.y
      const pu = program.uniforms.uPupil.value as Float32Array
      pu[0] = pupil.x
      pu[1] = pupil.y

      renderer.render({ scene: mesh })
    }
    raf = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
      ro.disconnect()
      gl.canvas.remove()
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }, [size])

  return <div ref={containerRef} className="h-full w-full" />
}
