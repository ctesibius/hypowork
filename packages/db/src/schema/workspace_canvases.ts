import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const workspaceCanvases = pgTable("workspace_canvases", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  nodes: jsonb("nodes").notNull().default([]),
  edges: jsonb("edges").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
