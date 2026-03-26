-- Link standalone company documents to a board project (Phase 2 factory / initiative hub).
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "project_id" uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_project_id_projects_id_fk'
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT "documents_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "documents_company_project_idx" ON "documents" ("company_id", "project_id");

-- One planning canvas document per project (reuse Phase 1 canvas engine on /documents/:id).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "planning_canvas_document_id" uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_planning_canvas_document_id_documents_id_fk'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_planning_canvas_document_id_documents_id_fk"
      FOREIGN KEY ("planning_canvas_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
