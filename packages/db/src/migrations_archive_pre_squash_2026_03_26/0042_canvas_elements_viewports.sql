CREATE TABLE "canvas_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"type" text NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"z_index" integer DEFAULT 0 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"parent_id" uuid,
	"source_document_id" uuid,
	"selected" boolean DEFAULT false NOT NULL,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "canvas_elements_document_canvas_idx" ON "canvas_elements" USING btree ("document_id","z_index");
--> statement-breakpoint
CREATE INDEX "canvas_elements_user_canvas_idx" ON "canvas_elements" USING btree ("document_id","is_private");
--> statement-breakpoint
CREATE INDEX "canvas_elements_type_idx" ON "canvas_elements" USING btree ("document_id","type");
--> statement-breakpoint
CREATE TABLE "canvas_viewports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text,
	"pan_x" integer DEFAULT 0 NOT NULL,
	"pan_y" integer DEFAULT 0 NOT NULL,
	"zoom" integer DEFAULT 100 NOT NULL,
	"locked_to_element_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_viewports" ADD CONSTRAINT "canvas_viewports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "canvas_viewports" ADD CONSTRAINT "canvas_viewports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "canvas_viewport_unique_idx" ON "canvas_viewports" USING btree ("document_id","user_id");
