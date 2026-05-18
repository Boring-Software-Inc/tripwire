import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Single-use nonces for GitHub App install callbacks.
 *
 * The signed state cookie proves integrity, while this table lets the callback
 * consume a nonce exactly once across server instances.
 */
export const installStates = pgTable(
	"github_install_states",
	{
		nonce: text("nonce").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at").notNull(),
		consumedAt: timestamp("consumed_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		index("github_install_states_user_idx").on(t.userId),
		index("github_install_states_expires_idx").on(t.expiresAt),
	],
);
