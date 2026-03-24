import { pgTable, uuid, text, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

/** Refinery: versioned requirements (markdown + optional YAML). */
export const softwareFactoryRequirements = pgTable(
  "software_factory_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull().default(""),
    structuredYaml: text("structured_yaml"),
    version: integer("version").notNull().default(1),
    supersedesId: uuid("supersedes_id"),
    /** JSON-serialized float array; enables cosine-similarity semantic search without pgvector. */
    embeddings: text("embeddings"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("sf_requirements_company_project_idx").on(table.companyId, table.projectId),
  }),
);

/** Foundry: architecture notes + optional Mermaid; links to requirement ids. */
export const softwareFactoryBlueprints = pgTable(
  "software_factory_blueprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull().default(""),
    diagramMermaid: text("diagram_mermaid"),
    linkedRequirementIds: jsonb("linked_requirement_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("sf_blueprints_company_project_idx").on(table.companyId, table.projectId),
  }),
);

/** Planner v2: work orders with status, assignee, dependency ids, optional PLC stage tag. */
export const softwareFactoryWorkOrders = pgTable(
  "software_factory_work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    descriptionMd: text("description_md").notNull().default(""),
    status: text("status").notNull().default("todo"),
    assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id, { onDelete: "set null" }),
    assignedUserId: text("assigned_user_id"),
    dependsOnWorkOrderIds: jsonb("depends_on_work_order_ids").$type<string[]>().notNull().default([]),
    linkedBlueprintId: uuid("linked_blueprint_id"),
    linkedIssueId: uuid("linked_issue_id").references(() => issues.id, { onDelete: "set null" }),
    plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),
    plannedEndAt: timestamp("planned_end_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    /** PLC stage node id this WO belongs to (e.g. "pdr", "cdr"). Resolved via project's plcTemplateId. */
    plcStageId: text("plc_stage_id"),
    /** Optional per-WO PLC template override. If absent, inherits from project. */
    plcTemplateId: uuid("plc_template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("sf_work_orders_company_project_idx").on(table.companyId, table.projectId),
  }),
);

/** Validator: ingest CI/review/manual payload; optional spawned work order. */
export const softwareFactoryValidationEvents = pgTable(
  "software_factory_validation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    summary: text("summary"),
    createdWorkOrderId: uuid("created_work_order_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectIdx: index("sf_validation_events_company_project_idx").on(table.companyId, table.projectId),
  }),
);
