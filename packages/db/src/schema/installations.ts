import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * GitHub App installations — one per org/user account.
 *
 * Tripwire's notion of "an account that has the GitHub App installed."
 * Distinct from Better Auth's `organization` (user-team membership).
 */
export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		githubInstallationId: integer("github_installation_id").notNull().unique(),
		githubAccountId: integer("github_account_id").notNull().unique(),
		githubAccountLogin: text("github_account_login").notNull(),
		githubAccountType: text("github_account_type").notNull().default("Organization"), // "Organization" | "User"
		avatarUrl: text("avatar_url"),
		// The user who owns this org in Tripwire
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [index("org_owner_idx").on(t.ownerId)],
);

/**
 * Repos that Tripwire is active on within an org.
 */
export const repositories = pgTable(
	"repositories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		githubRepoId: integer("github_repo_id").notNull().unique(),
		name: text("name").notNull(),
		fullName: text("full_name").notNull(), // "owner/repo"
		isPrivate: boolean("is_private").notNull().default(false),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [index("repo_org_idx").on(t.orgId)],
);
