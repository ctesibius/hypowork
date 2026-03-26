import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { agents } from "./agents.js";

export const workspaceSecrets = pgTable(
  "workspace_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id").notNull().references(() => workspaces.id),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("local_encrypted"),
    externalRef: text("external_ref"),
    latestVersion: integer("latest_version").notNull().default(1),
    description: text("description"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("workspace_secrets_workspace_idx").on(table.companyId),
    workspaceProviderIdx: index("workspace_secrets_workspace_provider_idx").on(
      table.companyId,
      table.provider,
    ),
    workspaceNameUq: uniqueIndex("workspace_secrets_workspace_name_uq").on(table.companyId, table.name),
  }),
);
