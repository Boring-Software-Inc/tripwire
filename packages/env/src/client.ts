/// <reference types="vite/client" />
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/**
 * Vite-only client env. Reads from `import.meta.env`. Bundles statically at
 * build time — only `VITE_*` vars are exposed to the browser.
 *
 * Do NOT import this from a non-Vite runtime (e.g. the CLI). Use
 * `@tripwire/env/server` for server vars instead.
 */
export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_GITHUB_APP_SLUG: z.string().min(1).optional(),
    VITE_REACT_SCAN_ENABLED: z.string().optional(),
    VITE_REACT_GRAB_ENABLED: z.string().optional(),
    // Comma-separated allowlist of landing-site origins the waitlist popup
    // closer may postMessage back to (e.g.
    // "https://tripwire.sh,http://localhost:3001"). The closer only ever posts
    // to an exact origin drawn from this list — never "*".
    VITE_WAITLIST_OPENER_ORIGINS: z.string().optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})
