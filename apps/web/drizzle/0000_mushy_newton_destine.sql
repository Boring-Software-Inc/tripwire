CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blacklist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"github_username" text NOT NULL,
	"github_user_id" integer,
	"avatar_url" text,
	"added_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributor_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"github_username" text NOT NULL,
	"github_user_id" integer,
	"avatar_url" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"repo_id" uuid,
	"title" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"action" text NOT NULL,
	"severity" text DEFAULT 'info',
	"description" text,
	"content_type" text,
	"pipeline_id" text,
	"rule_name" text,
	"target_github_username" text,
	"target_github_user_id" integer,
	"github_ref" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid,
	"github_username" text NOT NULL,
	"github_user_id" integer,
	"score" integer DEFAULT 0 NOT NULL,
	"total_blocks" integer DEFAULT 0 NOT NULL,
	"total_allows" integer DEFAULT 0 NOT NULL,
	"total_near_misses" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_installation_id" integer NOT NULL,
	"github_account_id" integer NOT NULL,
	"github_account_login" text NOT NULL,
	"github_account_type" text DEFAULT 'Organization' NOT NULL,
	"avatar_url" text,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_github_installation_id_unique" UNIQUE("github_installation_id"),
	CONSTRAINT "organizations_github_account_id_unique" UNIQUE("github_account_id")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"github_repo_id" integer NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_github_repo_id_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "rule_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"config" jsonb DEFAULT '{"aiSlopDetection":{"enabled":false,"action":"block"},"languageRequirement":{"enabled":false,"action":"block","language":"English"},"minMergedPrs":{"enabled":false,"action":"block","count":15},"accountAge":{"enabled":false,"action":"block","days":30},"maxPrsPerDay":{"enabled":false,"action":"block","limit":5},"maxFilesChanged":{"enabled":false,"action":"block","limit":20},"repoActivityMinimum":{"enabled":false,"action":"block","minRepos":3},"requireProfileReadme":{"enabled":false,"action":"block"},"cryptoAddressDetection":{"enabled":false,"action":"block"},"vouchedUsersOnly":{"enabled":false,"action":"block"},"aiHoneypot":{"enabled":false,"action":"block"},"contentScope":{"pullRequests":true,"issues":true,"comments":true},"repoFiles":{"rulesMd":{"autoSync":false,"customContent":""},"prTemplate":{"autoSync":false,"honeypotEnabled":false,"honeypotPhrases":[],"customContent":""}}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rule_configs_repo_id_unique" UNIQUE("repo_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"impersonated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github_id" text,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whitelist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"github_username" text NOT NULL,
	"github_user_id" integer,
	"avatar_url" text,
	"added_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_added_by_id_user_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_requests" ADD CONSTRAINT "contributor_requests_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_requests" ADD CONSTRAINT "contributor_requests_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_reputation" ADD CONSTRAINT "github_reputation_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_configs" ADD CONSTRAINT "rule_configs_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whitelist_entries" ADD CONSTRAINT "whitelist_entries_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whitelist_entries" ADD CONSTRAINT "whitelist_entries_added_by_id_user_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blacklist_repo_idx" ON "blacklist_entries" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blacklist_repo_username_uniq" ON "blacklist_entries" USING btree ("repo_id",lower("github_username"));--> statement-breakpoint
CREATE INDEX "requests_repo_idx" ON "contributor_requests" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "contributor_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_repo_user_idx" ON "contributor_requests" USING btree ("repo_id","github_username");--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_requests_pending_uniq" ON "contributor_requests" USING btree ("repo_id","github_username","kind") WHERE "contributor_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "conv_user_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conv_updated_idx" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "events_repo_idx" ON "events" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_action_idx" ON "events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "events_severity_idx" ON "events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "events_pipeline_idx" ON "events" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "reputation_score_idx" ON "github_reputation" USING btree ("score");--> statement-breakpoint
CREATE INDEX "reputation_blocks_idx" ON "github_reputation" USING btree ("total_blocks");--> statement-breakpoint
CREATE INDEX "reputation_username_idx" ON "github_reputation" USING btree ("github_username");--> statement-breakpoint
CREATE UNIQUE INDEX "github_reputation_repo_user_uniq" ON "github_reputation" USING btree ("repo_id",lower("github_username"));--> statement-breakpoint
CREATE INDEX "org_owner_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "repo_org_idx" ON "repositories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "whitelist_repo_idx" ON "whitelist_entries" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whitelist_repo_username_uniq" ON "whitelist_entries" USING btree ("repo_id",lower("github_username"));