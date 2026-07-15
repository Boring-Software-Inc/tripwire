import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// Better Auth core tables
// Managed by better-auth. We define them here so Drizzle is aware of
// them for relations / migrations.

export const ACCESS_STATUSES = ["pending", "approved", "rejected"] as const

export type AccessStatus = (typeof ACCESS_STATUSES)[number]

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    githubId: text("github_id").unique(),
    // admin plugin fields
    role: text("role").default("user"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    // Approval queue. Defaults to "pending" so a user row that reaches the
    // DB by any path other than an explicit approval is gated, not admitted.
    // Existing users are moved to "approved" by scripts/backfill-access-status.ts —
    // run it in the same window as the schema push or they lose access.
    accessStatus: text("access_status")
      .$type<AccessStatus>()
      .notNull()
      .default("pending"),
    accessReviewedAt: timestamp("access_reviewed_at"),
    accessReviewedBy: text("access_reviewed_by"),
    // Set at signup when the email already existed in `waitlist`, so admins
    // can prioritise people who signed up before the GitHub gate existed.
    // Carries the original waitlist join date, not the signup date.
    waitlistedAt: timestamp("waitlisted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("user_access_status_idx").on(table.accessStatus)]
)

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  impersonatedBy: text("impersonated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
})

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))
