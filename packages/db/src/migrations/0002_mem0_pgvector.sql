-- History + user state: no pgvector required (works on embedded Postgres without pgvector).
CREATE TABLE IF NOT EXISTS "mem0_memory_history" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "company_id" uuid NOT NULL,
  "memory_id" text NOT NULL,
  "previous_value" text,
  "new_value" text,
  "action" text NOT NULL,
  "created_at" text,
  "updated_at" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "row_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mem0_memory_history_company_id_idx" ON "mem0_memory_history" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mem0_memory_history_memory_id_idx" ON "mem0_memory_history" USING btree ("memory_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mem0_user_state" (
  "company_id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mem0_user_state_user_id_idx" ON "mem0_user_state" USING btree ("user_id");
--> statement-breakpoint
-- pgvector: only when the extension is available (external Postgres). Embedded Postgres has no vector package.
-- DDL uses EXECUTE inside DO so CREATE EXTENSION works from PL/pgSQL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE NOTICE 'pgvector extension is not available (e.g. embedded Postgres); skipping mem0_vectors. Use Postgres with pgvector for MEMORY_VECTOR_STORE=pgvector.';
    RETURN;
  END IF;
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
  EXECUTE $m$
    CREATE TABLE IF NOT EXISTS mem0_vectors (
      id text PRIMARY KEY NOT NULL,
      company_id uuid NOT NULL,
      payload jsonb NOT NULL,
      embedding vector(1536) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  $m$;
  EXECUTE 'CREATE INDEX IF NOT EXISTS mem0_vectors_company_id_idx ON mem0_vectors USING btree (company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS mem0_vectors_created_at_idx ON mem0_vectors USING btree (created_at)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS mem0_vectors_embedding_hnsw_cosine_idx ON mem0_vectors USING hnsw (embedding vector_cosine_ops)';
END $$;
