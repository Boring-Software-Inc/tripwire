import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const workingMemory = pgTable(
  "working_memory",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    chatId: text("chat_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("wm_scope_idx").on(t.scope, t.chatId, t.userId)]
)

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    chatId: text("chat_id").notNull(),
    userId: text("user_id"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (t) => [index("cm_chat_ts_idx").on(t.chatId, t.timestamp)]
)
