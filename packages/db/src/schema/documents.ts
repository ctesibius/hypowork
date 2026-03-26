import { pgTable, uuid, text, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id").notNull().references(() => workspaces.id),
    /** Optional board project (initiative / software factory hub). Null = company-wide note. */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    /**
     * **Collection placement** (serialized path): virtual grouping for standalone notes — same idea as
     * Obsidian vault folders / ZIP import paths (forward slashes, no filename). DB name `folder_path`
     * is legacy; API exposes `collectionPath` + `folderPath` (mirrored) until a `collections` FK exists.
     */
    folderPath: text("folder_path"),
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
    /** Optional PLC template for document-scoped lifecycle (override). Resolved before project.plcTemplateId. */
    plcTemplateId: uuid("plc_template_id"),
    /** Self-contained PLC graph when document has no template FK (snapshot, not inherited). */
    plcOverride: jsonb("plc_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUpdatedIdx: index("documents_company_updated_idx").on(table.companyId, table.updatedAt),
    companyCreatedIdx: index("documents_company_created_idx").on(table.companyId, table.createdAt),
    companyProjectIdx: index("documents_company_project_idx").on(table.companyId, table.projectId),
    companyFolderPathIdx: index("documents_workspace_folder_path_idx").on(table.companyId, table.folderPath),
  }),
);
