/**
 * Message Ratings - Human feedback signals for prompt improvement
 *
 * Captures user ratings on chat messages (thumbs up/down, stars, detailed feedback).
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
  boolean,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { authUsers } from "./auth.js";

export const messageRatings = pgTable(
  "message_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id").notNull().references(() => workspaces.id),
    messageId: uuid("message_id").notNull(), // FK to chat_messages (when created)
    userId: text("user_id").notNull().references(() => authUsers.id),

    // Rating values
    rating: integer("rating"), // 1-5 stars (nullable if only thumbs)
    thumbsUp: boolean("thumbs_up"), // boolean thumbs (nullable if only stars)

    // Detailed feedback
    feedbackText: text("feedback_text"), // Optional user explanation
    aspect: text("aspect"), // 'accuracy' | 'completeness' | 'tone' | 'timeliness'

    // Connection to prompt version
    promptVersionId: uuid("prompt_version_id"), // Which prompt generated this response

    // Context
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyMessageIdx: index("message_ratings_company_message_idx").on(
      table.companyId,
      table.messageId,
    ),
    promptVersionIdx: index("message_ratings_prompt_version_idx").on(table.promptVersionId),
    userIdx: index("message_ratings_user_idx").on(table.userId),
  }),
);
