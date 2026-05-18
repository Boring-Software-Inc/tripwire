CREATE TABLE "github_install_states" (
	"nonce" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_install_states" ADD CONSTRAINT "github_install_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "github_install_states_user_idx" ON "github_install_states" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "github_install_states_expires_idx" ON "github_install_states" USING btree ("expires_at");
