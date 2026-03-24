-- Global Skills Registry
--
-- Canonical skill definitions managed by superadmin.
-- Source of truth is markdown files on disk (server/skills/).
-- This table is a registry for display/admin and change detection.
-- Companies fork from these at onboarding via prompt_versions.

CREATE TABLE "global_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "skill_name" text NOT NULL UNIQUE,
  "display_name" text,
  "description" text,
  "file_path" text NOT NULL,
  "content_hash" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE INDEX "global_skills_name_idx" ON "global_skills" ("skill_name");

COMMENT ON TABLE "global_skills" IS
  'Superadmin-managed canonical skills. Source of truth is the markdown file on disk; this table tracks the registry for onboarding forks.';
