DO $$
BEGIN
  IF to_regclass('public.workspace_memberships') IS NULL
     AND to_regclass('public.company_memberships') IS NOT NULL THEN
    ALTER TABLE "company_memberships" RENAME TO "workspace_memberships";
  END IF;
END $$;

--> statement-breakpoint

ALTER TABLE "workspace_memberships"
  ADD COLUMN IF NOT EXISTS "reports_to" text,
  ADD COLUMN IF NOT EXISTS "human_title" text,
  ADD COLUMN IF NOT EXISTS "human_role" text;
