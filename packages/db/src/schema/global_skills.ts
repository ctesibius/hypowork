/**
 * Global Skills Registry — Tier 1: superadmin-managed canonical skills.
 *
 * The source of truth is the markdown file on disk (server/skills/).
 * This table is a registry for display/admin purposes only — content lives in files.
 *
 * Companies fork from these at onboarding into prompt_versions.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const globalSkills = pgTable(
  "global_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillName: text("skill_name").notNull().unique(),
    displayName: text("display_name"),
    description: text("description"),
    /** Relative or absolute path to the markdown file on disk. */
    filePath: text("file_path").notNull(),
    /** SHA-256 hash of current file content (for change detection). */
    contentHash: text("content_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("global_skills_name_idx").on(table.skillName),
  }),
);
