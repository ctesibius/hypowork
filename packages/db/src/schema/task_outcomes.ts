/**
 * Task Outcomes - Automated feedback signals for prompt improvement
 *
 * Records the outcome of every agent task execution (success/failure, time, budget).
 * Used in Phase 1.4.1 and Phase 4 for dual-loop prompt evolution.
 *
 * These are "implicit ratings" — no human needed to rate; the outcome itself is the signal.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export type TaskType =
  | "create_issue"
  | "complete_goal"
  | "write_code"
  | "research"
  | "plan_execution"
  | "chat_response"
  | "document_edit"
  | "canvas_update"
  | "other";

export const taskOutcomes = pgTable(
  "task_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),

    // Task identification
    taskId: uuid("task_id"), // Issue, goal, or heartbeat_run id
    taskType: text("task_type").notNull(), // TaskType union

    // Prompt version used
    promptVersionId: uuid("prompt_version_id"),

    // Success metrics
    success: boolean("success").notNull().default(false),
    criteriaMet: boolean("criteria_met").notNull().default(false),
    errorOccurred: boolean("error_occurred").notNull().default(false),
    errorType: text("error_type"), // e.g. 'timeout' | 'api_error' | 'validation_error'

    // Performance metrics
    durationMs: integer("duration_ms"),
    budgetUsedCents: integer("budget_used_cents"),

    // Complexity (for learning)
    complexityEstimated: integer("complexity_estimated"), // Estimated before task
    complexityActual: integer("complexity_actual"), // Actual (derived from duration, errors, etc.)

    // Context
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("task_outcomes_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
    taskTypeIdx: index("task_outcomes_task_type_idx").on(table.taskType),
    successIdx: index("task_outcomes_success_idx").on(table.success),
    promptVersionIdx: index("task_outcomes_prompt_version_idx").on(table.promptVersionId),
    createdAtIdx: index("task_outcomes_created_at_idx").on(table.createdAt),
  }),
);
