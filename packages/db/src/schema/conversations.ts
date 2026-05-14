import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { repositories } from "./installations";

/**
 * AI chat conversations — persisted chats with full message history.
 */
export const conversations = pgTable(
	"conversations",
	{
		id: uuid("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		repoId: uuid("repo_id").references(() => repositories.id, {
			onDelete: "set null",
		}),
		title: text("title"),
		// biome-ignore lint/suspicious/noExplicitAny: stored chat message payload is open-shape
		messages: jsonb("messages").$type<any[]>().notNull().default([]),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [
		index("conv_user_idx").on(t.userId),
		index("conv_updated_idx").on(t.updatedAt),
	],
);
