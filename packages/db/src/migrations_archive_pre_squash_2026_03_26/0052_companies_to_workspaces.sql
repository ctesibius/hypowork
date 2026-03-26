DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    ALTER TABLE "companies" RENAME TO "workspaces";
  END IF;

  IF to_regclass('public.company_memberships') IS NOT NULL THEN
    ALTER TABLE "company_memberships" RENAME TO "workspace_memberships";
  END IF;

  IF to_regclass('public.company_secrets') IS NOT NULL THEN
    ALTER TABLE "company_secrets" RENAME TO "workspace_secrets";
  END IF;

  IF to_regclass('public.company_secret_versions') IS NOT NULL THEN
    ALTER TABLE "company_secret_versions" RENAME TO "workspace_secret_versions";
  END IF;

  IF to_regclass('public.company_logos') IS NOT NULL THEN
    ALTER TABLE "company_logos" RENAME TO "workspace_logos";
  END IF;

  IF to_regclass('public.company_canvases') IS NOT NULL THEN
    ALTER TABLE "company_canvases" RENAME TO "workspace_canvases";
  END IF;

  IF to_regclass('public.plugin_company_settings') IS NOT NULL THEN
    ALTER TABLE "plugin_company_settings" RENAME TO "plugin_workspace_settings";
  END IF;
END $$;
