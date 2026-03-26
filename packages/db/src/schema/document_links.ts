import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { documents } from "./documents.js";

/** Extracted [[wikilink]] / @doc references from standalone company documents (markdown). */
export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    targetDocumentId: uuid("target_document_id").references(() => documents.id, { onDelete: "cascade" }),
    rawReference: text("raw_reference").notNull(),
    linkKind: text("link_kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdx: index("document_links_source_document_id_idx").on(table.sourceDocumentId),
    targetIdx: index("document_links_company_target_idx").on(table.companyId, table.targetDocumentId),
    companySourceIdx: index("document_links_company_source_idx").on(table.companyId, table.sourceDocumentId),
  }),
);
