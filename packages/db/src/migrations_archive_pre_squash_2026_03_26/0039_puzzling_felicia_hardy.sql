CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"target_document_id" uuid,
	"raw_reference" text NOT NULL,
	"link_kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_target_document_id_documents_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_links_source_document_id_idx" ON "document_links" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "document_links_company_target_idx" ON "document_links" USING btree ("company_id","target_document_id");--> statement-breakpoint
CREATE INDEX "document_links_company_source_idx" ON "document_links" USING btree ("company_id","source_document_id");