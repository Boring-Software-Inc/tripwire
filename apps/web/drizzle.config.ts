import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

const appDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(appDir, "../..")
const DEV_DATABASE_DIR = resolve(repoRoot, ".tripwire/pglite")

// .env lives at the monorepo root so all packages (web, future cli) share it.
config({
  path: [
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env"),
    resolve(appDir, ".env.local"),
    resolve(appDir, ".env"),
  ],
})

const isProduction = process.env.NODE_ENV === "production"
const databaseUrl = process.env.DATABASE_URL

if (isProduction && !databaseUrl) {
  throw new Error("DATABASE_URL is required in production.")
}

if (!databaseUrl) {
  mkdirSync(dirname(DEV_DATABASE_DIR), { recursive: true })
}

export default defineConfig({
  out: resolve(appDir, "drizzle"),
  schema: resolve(repoRoot, "packages/db/src/schema/index.ts"),
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
