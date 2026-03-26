import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { plugins } from "./plugins.js";

export const pluginWorkspaceSettings = pgTable(
  "plugin_workspace_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().notNull().default({}),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("plugin_workspace_settings_workspace_idx").on(table.companyId),
    pluginIdx: index("plugin_workspace_settings_plugin_idx").on(table.pluginId),
    workspacePluginUq: uniqueIndex("plugin_workspace_settings_workspace_plugin_uq").on(
      table.companyId,
      table.pluginId,
    ),
  }),
);
