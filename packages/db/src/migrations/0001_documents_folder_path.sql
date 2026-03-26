ALTER TABLE "documents" ADD COLUMN "folder_path" text;
--> statement-breakpoint
CREATE INDEX "documents_workspace_folder_path_idx" ON "documents" USING btree ("workspace_id","folder_path");
