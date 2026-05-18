CREATE TABLE "global_vouches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_username" text NOT NULL,
	"github_user_id" integer NOT NULL,
	"avatar_url" text,
	"vouched_by_id" text NOT NULL,
	"vouched_by_name" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouch_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_username" text NOT NULL,
	"github_user_id" integer NOT NULL,
	"avatar_url" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "global_vouches" ADD CONSTRAINT "global_vouches_vouched_by_id_user_id_fk" FOREIGN KEY ("vouched_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vouch_requests" ADD CONSTRAINT "vouch_requests_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "global_vouches_username_idx" ON "global_vouches" USING btree ("github_username");
--> statement-breakpoint
CREATE INDEX "global_vouches_user_id_idx" ON "global_vouches" USING btree ("github_user_id");
--> statement-breakpoint
CREATE INDEX "global_vouches_voucher_idx" ON "global_vouches" USING btree ("vouched_by_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "global_vouches_user_voucher_uniq" ON "global_vouches" USING btree ("github_user_id","vouched_by_id");
--> statement-breakpoint
CREATE INDEX "vouch_requests_status_idx" ON "vouch_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "vouch_requests_username_idx" ON "vouch_requests" USING btree ("github_username");
--> statement-breakpoint
CREATE UNIQUE INDEX "vouch_requests_pending_uniq" ON "vouch_requests" USING btree ("github_user_id") WHERE "vouch_requests"."status" = 'pending';
