ALTER TABLE "documents" ADD COLUMN "kind" text DEFAULT 'prose' NOT NULL;
ALTER TABLE "documents" ADD CONSTRAINT "documents_kind_check" CHECK ("kind" IN ('prose', 'canvas'));
