ALTER TABLE "projects" ADD COLUMN "created_by_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
WITH "first_project_create" AS (
  SELECT DISTINCT ON ("entity_id")
    "entity_id",
    "actor_type",
    "actor_id",
    "agent_id"
  FROM "activity_log"
  WHERE "action" = 'project.created' AND "entity_type" = 'project'
  ORDER BY "entity_id", "created_at" ASC
)
UPDATE "projects" AS p
SET
  "created_by_user_id" = CASE WHEN fc."actor_type" = 'user' THEN fc."actor_id" ELSE NULL END,
  "created_by_agent_id" = CASE
    WHEN fc."actor_type" = 'agent' THEN COALESCE(
      fc."agent_id",
      CASE
        WHEN fc."actor_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN fc."actor_id"::uuid
        ELSE NULL
      END
    )
    ELSE NULL
  END
FROM "first_project_create" AS fc
WHERE p."id"::text = fc."entity_id"
  AND p."created_by_user_id" IS NULL
  AND p."created_by_agent_id" IS NULL;