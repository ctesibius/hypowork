ALTER TABLE "projects" ADD COLUMN "factory_template" text DEFAULT 'software' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_factory_template_check" CHECK ("factory_template" IN ('none', 'software', 'hardware'));
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD COLUMN "linked_issue_id" uuid;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD COLUMN "planned_start_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD COLUMN "planned_end_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_work_orders_linked_issue_idx" ON "software_factory_work_orders" USING btree ("linked_issue_id");
--> statement-breakpoint
CREATE INDEX "sf_requirements_fts_idx" ON "software_factory_requirements" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body_md", '')));
