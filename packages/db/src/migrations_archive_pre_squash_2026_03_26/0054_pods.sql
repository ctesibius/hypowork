-- Migration: 0054_pods
-- Phase 5: Pods — named groups of agents (Design Engineering, Learner, etc.)
-- CEO Agent spawns and monitors pods; each pod has a lead agent and optional budget.

CREATE TABLE "pods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "name" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'general',
  "lead_agent_id" uuid,
  "status" text NOT NULL DEFAULT 'active',
  "pause_reason" text,
  "paused_at" timestamptz,
  "last_active_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "pods_company_idx" ON "pods"("company_id");
CREATE INDEX "pods_company_status_idx" ON "pods"("company_id", "status");
CREATE INDEX "pods_lead_agent_idx" ON "pods"("lead_agent_id");
