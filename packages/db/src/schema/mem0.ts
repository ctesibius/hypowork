import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

export const mem0Vectors = pgTable(
  "mem0_vectors",
  {
    id: text("id").primaryKey(),
    companyId: uuid("company_id").notNull(),
    payload: jsonb("payload").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    companyIdx: index("mem0_vectors_company_id_idx").on(table.companyId),
    createdAtIdx: index("mem0_vectors_created_at_idx").on(table.createdAt),
  }),
);

export const mem0MemoryHistory = pgTable(
  "mem0_memory_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    companyId: uuid("company_id").notNull(),
    memoryId: text("memory_id").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    action: text("action").notNull(),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
    isDeleted: integer("is_deleted").notNull().default(0),
    rowCreatedAt: timestamp("row_created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("mem0_memory_history_company_id_idx").on(table.companyId),
    memoryIdIdx: index("mem0_memory_history_memory_id_idx").on(table.memoryId),
  }),
);

export const mem0UserState = pgTable(
  "mem0_user_state",
  {
    companyId: uuid("company_id").primaryKey(),
    userId: text("user_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("mem0_user_state_user_id_idx").on(table.userId),
  }),
);
