CREATE TABLE "software_factory_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"structured_yaml" text,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_factory_blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"diagram_mermaid" text,
	"linked_requirement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_factory_work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"assignee_agent_id" uuid,
	"assigned_user_id" text,
	"depends_on_work_order_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_blueprint_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_factory_validation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"created_work_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "software_factory_requirements" ADD CONSTRAINT "software_factory_requirements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_requirements" ADD CONSTRAINT "software_factory_requirements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_requirements" ADD CONSTRAINT "software_factory_requirements_supersedes_id_software_factory_requirements_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."software_factory_requirements"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_blueprints" ADD CONSTRAINT "software_factory_blueprints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_blueprints" ADD CONSTRAINT "software_factory_blueprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_linked_blueprint_id_software_factory_blueprints_id_fk" FOREIGN KEY ("linked_blueprint_id") REFERENCES "public"."software_factory_blueprints"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_validation_events" ADD CONSTRAINT "software_factory_validation_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_validation_events" ADD CONSTRAINT "software_factory_validation_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_validation_events" ADD CONSTRAINT "software_factory_validation_events_created_work_order_id_software_factory_work_orders_id_fk" FOREIGN KEY ("created_work_order_id") REFERENCES "public"."software_factory_work_orders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_requirements_company_project_idx" ON "software_factory_requirements" USING btree ("company_id","project_id");
--> statement-breakpoint
CREATE INDEX "sf_blueprints_company_project_idx" ON "software_factory_blueprints" USING btree ("company_id","project_id");
--> statement-breakpoint
CREATE INDEX "sf_work_orders_company_project_idx" ON "software_factory_work_orders" USING btree ("company_id","project_id");
--> statement-breakpoint
CREATE INDEX "sf_validation_events_company_project_idx" ON "software_factory_validation_events" USING btree ("company_id","project_id");
