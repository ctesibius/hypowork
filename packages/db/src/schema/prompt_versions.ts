/**
 * Prompt Versions - Versioned, lineage-tracked prompts for dual-loop evolution
 *
 * Each skill (e.g. 'general', 'react-expert', 'nestjs-expert') has a current 'baseline'
 * prompt and multiple 'candidate' prompts being evaluated. Lineage (parent_id) tracks
 * which prompt led to which improvement.
 *
 * Used in Phase 1.6.1 and Phase 4 for dual-loop prompt evolution.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export type PromptStatus = "baseline" | "candidate" | "promoted" | "rejected";

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),

    // Identification
    skillName: text("skill_name").notNull(), // e.g. 'general', 'react-expert', 'nestjs-expert'
    version: integer("version").notNull(), // Sequential version number

    // Content
    content: text("content").notNull(), // The actual prompt text

    // Lineage
    parentId: uuid("parent_id").references((): any => promptVersions.id), // Parent prompt version

    // Status
    status: text("status").notNull().default("candidate"), // 'baseline' | 'candidate' | 'promoted' | 'rejected'

    // Metrics (updated as ratings/task outcomes come in)
    metrics: jsonb("metrics").$type<{
      avgRating: number;
      responseCount: number;
      thumbsUpRate: number;
      improvementOverParent: number;
      automatedSuccessRate: number;
      efficiencyScore: number;
      compositeScore: number;
    }>().default({
      avgRating: 0,
      responseCount: 0,
      thumbsUpRate: 0,
      improvementOverParent: 0,
      automatedSuccessRate: 0,
      efficiencyScore: 0,
      compositeScore: 0,
    }),

    // Mutation info (how this candidate was created)
    mutationType: text("mutation_type"), // 'structural' | 'instruction' | 'examples' | 'constraints' | 'llm_suggested'
    mutationNotes: text("mutation_notes"), // Description of what changed

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  },
  (table) => ({
    companySkillIdx: index("prompt_versions_company_skill_idx").on(
      table.companyId,
      table.skillName,
    ),
    statusIdx: index("prompt_versions_status_idx").on(table.status),
    parentIdx: index("prompt_versions_parent_idx").on(table.parentId),
    companyBaselineIdx: index("prompt_versions_company_baseline_idx").on(
      table.companyId,
      table.skillName,
      table.status,
    ),
  }),
);
