import { createHash } from "node:crypto"
import { Databuddy } from "@databuddy/sdk/node"
import { createFileRoute } from "@tanstack/react-router"
import { env } from "@tripwire/env/server"

/**
 * Ingest endpoint for `@dither-kit/cli` telemetry. The CLI has no secret and
 * cannot call Databuddy directly — it POSTs here; we forward with the server
 * key. Fire-and-forget on the CLI side; we still await the track so serverless
 * doesn't drop the event before flush.
 *
 * Opt-out lives on the client (`DO_NOT_TRACK` / `DITHER_KIT_TELEMETRY=0`).
 * This route is intentionally write-only: no auth, no PII expected, properties
 * are allowlisted by shape not by free-form dump.
 */

const WEBSITE_ID = "09661145-7249-45d9-a9e3-f1a93e9c7266"

const ALLOWED_EVENTS = new Set([
  "cli_run",
  "cli_add",
  "cli_list",
  "cli_init",
  "cli_update",
  "cli_diff",
])

const db = env.DATABUDDY_API_KEY
  ? new Databuddy({
      apiKey: env.DATABUDDY_API_KEY,
      websiteId: WEBSITE_ID,
      namespace: "dither-kit-cli",
      source: "cli",
      enableBatching: false,
    })
  : null

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
}

type PropValue = string | number | boolean | null | string[]

function isPropValue(v: unknown): v is PropValue {
  if (v === null) return true
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return true
  }
  return Array.isArray(v) && v.every((x) => typeof x === "string")
}

function sanitizeProperties(
  raw: unknown,
): Record<string, PropValue> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const out: Record<string, PropValue> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.length > 64 || !isPropValue(value)) continue
    if (typeof value === "string" && value.length > 256) {
      out[key] = value.slice(0, 256)
      continue
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 32).map((s) => s.slice(0, 64))
      continue
    }
    out[key] = value
  }
  return out
}

function fallbackAnon(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const ua = request.headers.get("user-agent") ?? ""
  return createHash("sha256").update(`cli|${ip}|${ua}`).digest("hex").slice(0, 32)
}

async function postHandler({ request }: { request: Request }) {
  if (!db) {
    return new Response(JSON.stringify({ ok: true, tracked: false }), {
      status: 202,
      headers: { "Content-Type": "application/json", ...CORS },
    })
  }

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > 8_192) {
      return new Response(JSON.stringify({ error: "payload too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json", ...CORS },
      })
    }
    body = JSON.parse(text)
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    })
  }

  const name = (body as { name?: unknown }).name
  if (typeof name !== "string" || !ALLOWED_EVENTS.has(name)) {
    return new Response(JSON.stringify({ error: "unknown event" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    })
  }

  const rawAnon = (body as { anonymousId?: unknown }).anonymousId
  const anonymousId =
    typeof rawAnon === "string" && rawAnon.length > 0 && rawAnon.length <= 64
      ? rawAnon
      : fallbackAnon(request)

  const properties = sanitizeProperties(
    (body as { properties?: unknown }).properties,
  )

  try {
    await db.track({
      name,
      anonymousId,
      properties: {
        ...properties,
        ua: (request.headers.get("user-agent") ?? "").slice(0, 256),
      },
    })
  } catch {
    // Never fail the CLI over analytics.
  }

  return new Response(JSON.stringify({ ok: true, tracked: true }), {
    status: 202,
    headers: { "Content-Type": "application/json", ...CORS },
  })
}

function optionsHandler() {
  return new Response(null, { status: 204, headers: CORS })
}

export const Route = createFileRoute("/r/cli-event")({
  server: {
    handlers: {
      POST: postHandler,
      OPTIONS: optionsHandler,
    },
  },
})
