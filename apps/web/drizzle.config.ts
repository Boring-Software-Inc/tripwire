import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// .env lives at the monorepo root so all packages (web, future cli) share it.
config({ path: ["../../.env.local", "../../.env", ".env.local", ".env"] })

const DEV_DATABASE_DIR = "../../.tripwire/pglite"
const isProduction = process.env.NODE_ENV === "production"
const databaseUrl = process.env.DATABASE_URL

if (isProduction && !databaseUrl) {
  throw new Error("DATABASE_URL is required in production.")
}

if (!databaseUrl) {
  mkdirSync(dirname(DEV_DATABASE_DIR), { recursive: true })
}

export default defineConfig({
  out: "./drizzle",
  schema: "../../packages/db/src/schema/index.ts",
  dialect: "postgresql",
  ...(databaseUrl
    ? {
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {
        driver: "pglite",
        dbCredentials: {
          url: DEV_DATABASE_DIR,
        },
      }),
})
