import { pgTable, uuid, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/** PLC Stage node — part of a plc_templates.stages JSONB graph. */
export type PlcStageNode = {
  id: string;
  label: string;
  kind: "gate" | "phase" | "checkpoint";
  description?: string;
};

/** PLC Stage edge — part of a plc_templates.stages JSONB graph. */
export type PlcStageEdge = {
  from: string;
  to: string;
};

/** Full stages graph stored in plc_templates.stages. */
export type PlcStagesGraph = {
  nodes: PlcStageNode[];
  edges: PlcStageEdge[];
};

/** Company-scoped PLC template: reusable project lifecycle graph. */
export const plcTemplates = pgTable(
  "plc_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Directed graph of stages (nodes) and transitions (edges). */
    stages: jsonb("stages").$type<PlcStagesGraph>().notNull().default({ nodes: [], edges: [] }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("plc_templates_company_idx").on(table.companyId),
  }),
);
