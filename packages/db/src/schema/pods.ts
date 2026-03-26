import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

/**
 * Pods — named groups of agents that share a mission or specialty.
 *
 * Phase 5: CEO Agent spawns and monitors pods (Design Engineer, Project Engineer,
 * Learner, Factory Runner). Each pod is a team with a lead and optional budget.
 *
 * Pod membership is tracked via `workspace_memberships.role = 'pod:{podId}'` — agents
 * belong to a pod through their workspace role, not a separate join table.
 */
export const pods = pgTable(
  "pods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id").notNull().references(() => workspaces.id),
    /** Human-readable name, e.g. "Design Engineering Pod", "Learner Pod" */
    name: text("name").notNull(),
    /** Pod kind determines default capabilities and heartbeat interval */
    kind: text("kind").notNull().default("general"),
    /** ID of the agent that leads this pod (the "foreman" or "lead") */
    leadAgentId: uuid("lead_agent_id"),
    status: text("status").notNull().default("active"),
    pauseReason: text("pause_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    /** ISO timestamp of when the pod was last active */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("pods_company_idx").on(table.companyId),
    companyStatusIdx: index("pods_company_status_idx").on(table.companyId, table.status),
    leadAgentIdx: index("pods_lead_agent_idx").on(table.leadAgentId),
  }),
);
