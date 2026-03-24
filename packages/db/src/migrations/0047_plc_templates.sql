CREATE TABLE "plc_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stages" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plc_templates_company_idx" ON "plc_templates" USING btree ("company_id");
--> statement-breakpoint
ALTER TABLE "plc_templates" ADD CONSTRAINT "plc_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "plc_template_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_plc_template_id_plc_templates_id_fk" FOREIGN KEY ("plc_template_id") REFERENCES "public"."plc_templates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "plc_template_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "plc_override" jsonb;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_plc_template_id_plc_templates_id_fk" FOREIGN KEY ("plc_template_id") REFERENCES "public"."plc_templates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD COLUMN "plc_stage_id" text;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD COLUMN "plc_template_id" uuid;
--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "sf_work_orders_plc_template_id_plc_templates_id_fk" FOREIGN KEY ("plc_template_id") REFERENCES "public"."plc_templates"("id") ON DELETE set null ON UPDATE no action;
