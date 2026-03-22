import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companyCanvases = pgTable("company_canvases", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  /** React Flow nodes JSON */
  nodes: jsonb("nodes").notNull().default([]),
  /** React Flow edges JSON */
  edges: jsonb("edges").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
