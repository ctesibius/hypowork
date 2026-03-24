import { pgTable, uuid, text, timestamp, date, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { goals } from "./goals.js";
import { agents } from "./agents.js";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    goalId: uuid("goal_id").references(() => goals.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    leadAgentId: uuid("lead_agent_id").references(() => agents.id),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    targetDate: date("target_date"),
    color: text("color"),
    pauseReason: text("pause_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    executionWorkspacePolicy: jsonb("execution_workspace_policy").$type<Record<string, unknown>>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Canonical Phase 2 planning board: canvas `documents` row (kind canvas). FK enforced in SQL migration. */
    planningCanvasDocumentId: uuid("planning_canvas_document_id"),
    /** Canonical Phase 2 PLC (project lifecycle) template. */
    plcTemplateId: uuid("plc_template_id"),
    /** `none` hides Design Factory tab; `software` / `hardware` select factory module (hardware = Phase 3). */
    factoryTemplate: text("factory_template").notNull().default("software"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("projects_company_idx").on(table.companyId),
  }),
);
