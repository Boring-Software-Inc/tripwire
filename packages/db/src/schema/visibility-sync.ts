import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { repositories } from "./installations"

export type VisibilitySyncStatus =
  | "queued"
  | "running"
  | "completed"
  | "errored"

export interface VisibilitySyncStats {
  prs: number
  issues: number
  contributors: number
  eventsInserted: number
  scored: number
  scoreSkipped: number
}

export const visibilitySyncRuns = pgTable(
  "visibility_sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<VisibilitySyncStatus>()
      .notNull()
      .default("queued"),
    requestedById: text("requested_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    stats: jsonb("stats").$type<VisibilitySyncStats>().notNull().default({
      prs: 0,
      issues: 0,
      contributors: 0,
      eventsInserted: 0,
      scored: 0,
      scoreSkipped: 0,
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("visibility_sync_repo_created_idx").on(t.repoId, t.createdAt),
    index("visibility_sync_requester_status_idx").on(t.requestedById, t.status),
  ]
)

export type VisibilitySyncRun = typeof visibilitySyncRuns.$inferSelect
export type NewVisibilitySyncRun = typeof visibilitySyncRuns.$inferInsert
