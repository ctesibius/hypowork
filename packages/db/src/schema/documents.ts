import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title"),
    format: text("format").notNull().default("markdown"),
    /** `prose` = markdown-first surface; `canvas` = spatial view over same canonical prose + graph. */
    kind: text("kind").notNull().default("prose"),
    /** Canonical prose/markdown (wikilinks, Mem0, Plate). SSOT for document text. */
    latestBody: text("latest_body").notNull(),
    /** React Flow graph JSON `{ nodes, edges }`; primary docPage must not duplicate `latest_body`. */
    canvasGraphJson: text("canvas_graph_json"),
    latestRevisionId: uuid("latest_revision_id"),
    latestRevisionNumber: integer("latest_revision_number").notNull().default(1),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUpdatedIdx: index("documents_company_updated_idx").on(table.companyId, table.updatedAt),
    companyCreatedIdx: index("documents_company_created_idx").on(table.companyId, table.createdAt),
  }),
);
