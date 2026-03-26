-- Bind a "Design Engineer" / Software Factory Runner agent to a project.
-- The agent drives Refinery → Foundry → Planner → Validator autonomously.

ALTER TABLE "projects"
  ADD COLUMN "software_factory_lead_agent_id" uuid
  REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
