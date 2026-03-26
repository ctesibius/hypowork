-- Versioned prompt/skill rows per company (baseline / candidate / promoted / rejected).
-- Required for skill seeding into prompt_versions at company onboarding.

CREATE TABLE "prompt_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "skill_name" text NOT NULL,
  "version" integer NOT NULL,
  "content" text NOT NULL,
  "parent_id" uuid REFERENCES "prompt_versions"("id"),
  "status" text NOT NULL DEFAULT 'candidate',
  "metrics" jsonb DEFAULT '{"avgRating":0,"responseCount":0,"thumbsUpRate":0,"improvementOverParent":0,"automatedSuccessRate":0,"efficiencyScore":0,"compositeScore":0}'::jsonb,
  "mutation_type" text,
  "mutation_notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "evaluated_at" timestamptz
);

--> statement-breakpoint

CREATE INDEX "prompt_versions_company_skill_idx" ON "prompt_versions" ("company_id", "skill_name");

--> statement-breakpoint

CREATE INDEX "prompt_versions_status_idx" ON "prompt_versions" ("status");

--> statement-breakpoint

CREATE INDEX "prompt_versions_parent_idx" ON "prompt_versions" ("parent_id");

--> statement-breakpoint

CREATE INDEX "prompt_versions_company_baseline_idx" ON "prompt_versions" ("company_id", "skill_name", "status");
