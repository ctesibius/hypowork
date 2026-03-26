import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id").notNull().references(() => workspaces.id),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    status: text("status").notNull().default("active"),
    membershipRole: text("membership_role"),
    reportsTo: text("reports_to"),
    humanTitle: text("human_title"),
    humanRole: text("human_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspacePrincipalUniqueIdx: uniqueIndex("workspace_memberships_workspace_principal_unique_idx").on(
      table.companyId,
      table.principalType,
      table.principalId,
    ),
    principalStatusIdx: index("workspace_memberships_principal_status_idx").on(
      table.principalType,
      table.principalId,
      table.status,
    ),
    workspaceStatusIdx: index("workspace_memberships_workspace_status_idx").on(
      table.companyId,
      table.status,
    ),
  }),
);
