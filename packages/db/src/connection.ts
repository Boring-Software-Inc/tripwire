import { existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres"
import { env } from "@tripwire/env/server"
import * as schema from "./schema"

type PgliteDrizzleModule = typeof import("drizzle-orm/pglite")

function findMonorepoRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const monorepoRoot = findMonorepoRoot(here)
const DEV_DATABASE_DIR = resolve(monorepoRoot, ".tripwire/pglite")
const isProduction = process.env.NODE_ENV === "production"
const shouldUseDevDatabase = !isProduction && !env.DATABASE_URL

if (isProduction && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for @tripwire/db.")
}

if (shouldUseDevDatabase) {
  mkdirSync(dirname(DEV_DATABASE_DIR), { recursive: true })
}

const createPostgresDatabase = () =>
  drizzlePostgres(env.DATABASE_URL!, { schema })
type AppDatabase = ReturnType<typeof createPostgresDatabase>

const createDevDatabase = () => {
  const pgliteDriver = "drizzle-orm/pglite"
  const { drizzle } = require(pgliteDriver) as PgliteDrizzleModule
  return drizzle(DEV_DATABASE_DIR, { schema }) as unknown as AppDatabase
}

export const db: AppDatabase = shouldUseDevDatabase
  ? createDevDatabase()
  : createPostgresDatabase()

export type Database = typeof db
