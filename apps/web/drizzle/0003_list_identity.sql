DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "whitelist_entries" WHERE "github_user_id" IS NULL
  ) OR EXISTS (
    SELECT 1 FROM "blacklist_entries" WHERE "github_user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce github_user_id NOT NULL while legacy list entries have null GitHub IDs. Backfill those entries before running this migration.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "whitelist_entries" ALTER COLUMN "github_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "blacklist_entries" ALTER COLUMN "github_user_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "whitelist_repo_user_id_uniq" ON "whitelist_entries" USING btree ("repo_id","github_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "blacklist_repo_user_id_uniq" ON "blacklist_entries" USING btree ("repo_id","github_user_id");
