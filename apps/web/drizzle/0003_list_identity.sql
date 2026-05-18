CREATE UNIQUE INDEX "whitelist_repo_user_id_uniq" ON "whitelist_entries" USING btree ("repo_id","github_user_id") WHERE "github_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "blacklist_repo_user_id_uniq" ON "blacklist_entries" USING btree ("repo_id","github_user_id") WHERE "github_user_id" IS NOT NULL;
