-- Vector embeddings for software factory requirements (semantic search).
-- Stored as JSON float array in a text column; cosine similarity computed in-app.
-- No pgvector required.

ALTER TABLE "software_factory_requirements"
  ADD COLUMN "embeddings" text;

CREATE INDEX "sf_requirements_embeddings_idx"
  ON "software_factory_requirements" USING btree ("company_id")
  WHERE "embeddings" IS NOT NULL;
