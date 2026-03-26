import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { documents } from "./documents.js";

/**
 * Canvas elements that are private to a specific canvas view of a document.
 *
 * Hypopedia-style view model:
 * - Document body is NEVER modified when switching prose ↔ canvas views
 * - Canvas view: document renders as a Note card + user-added private elements
 * - Private elements (shapes, connectors, annotations) live here, not in document.body
 * - "Make Standalone" extracts selected elements → new document
 */
export const canvasElements = pgTable(
  "canvas_elements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** The document this canvas view belongs to */
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** Element type: 'shape' | 'connector' | 'text' | 'frame' | 'note' | 'image' */
    type: text("type").notNull(),
    /** Position on canvas (x, y) */
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    /** Size */
    width: integer("width"),
    height: integer("height"),
    /** z-index for layering */
    zIndex: integer("z_index").notNull().default(0),
    /** Rotation in degrees */
    rotation: integer("rotation").notNull().default(0),
    /** Element-specific payload (shape style, text content, connector endpoints, etc.) */
    payload: jsonb("payload").notNull().default({}),
    /** Whether this element was created by the current user viewing the canvas */
    isPrivate: boolean("is_private").notNull().default(false),
    /** Parent element id (for grouping/frame membership) */
    parentId: uuid("parent_id"),
    /** Source document if this element was created from "Make Standalone" */
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    /** Whether this element is selected in the current view */
    selected: boolean("selected").notNull().default(false),
    /** Created by agent (if applicable) */
    createdByAgentId: uuid("created_by_agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** List elements for a document's canvas view, ordered by z-index */
    documentCanvasIdx: index("canvas_elements_document_canvas_idx").on(
      table.documentId,
      table.zIndex,
    ),
    /** Find private elements for a user viewing a document */
    userCanvasIdx: index("canvas_elements_user_canvas_idx").on(
      table.documentId,
      table.isPrivate,
    ),
    /** Query elements by type */
    typeIdx: index("canvas_elements_type_idx").on(table.documentId, table.type),
  }),
);

/** Canvas viewport state (position, zoom) per document per user */
export const canvasViewports = pgTable(
  "canvas_viewports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** User id who owns this viewport (null = default viewport for all users) */
    userId: text("user_id"),
    /** Pan position */
    panX: integer("pan_x").notNull().default(0),
    panY: integer("pan_y").notNull().default(0),
    /** Zoom level (100 = 100%) */
    zoom: integer("zoom").notNull().default(100),
    /** Whether viewport is locked to a specific element */
    lockedToElementId: uuid("locked_to_element_id"),
    /** Last updated */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** One viewport per document per user; unique constraint ensures one row */
    uniqueCanvasViewport: index("canvas_viewport_unique_idx").on(
      table.documentId,
      table.userId,
    ),
  }),
);

export type CanvasElementType =
  | "shape"
  | "connector"
  | "text"
  | "frame"
  | "note"
  | "image"
  | "group";
