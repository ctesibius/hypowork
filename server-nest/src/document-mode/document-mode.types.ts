/**
 * Document Mode Types - Prose ↔ Canvas view switch (Phase 1.7g)
 *
 * Hypopedia/AFFiNE-style view switching:
 * - One document id, same route — switching is a VIEW CHANGE, not migration
 * - Document body is NEVER modified by the view switch
 * - Canvas view: document renders as a Note card + private canvas elements
 * - "Make Standalone": extract selected canvas elements → new document
 */

export interface DocumentModeSwitchRequest {
  documentId: string;
  targetMode: DocumentMode;
  /** @deprecated Not used — view switch never migrates content */
  migrationPolicy?: never;
  /** @deprecated Not used */
  baseRevisionId?: never;
}

export type DocumentMode = "prose" | "canvas";

export interface DocumentModeResult {
  documentId: string;
  mode: DocumentMode;
  /** Always false — view switch is not a migration */
  migrated: false;
  migrationWarnings?: string[];
  newRevisionId?: never;
}

/**
 * Canvas element stored in canvas_elements table.
 * These are private to the canvas view and do not live in document.body.
 */
export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex: number;
  rotation: number;
  payload: CanvasElementPayload;
  isPrivate: boolean;
  parentId?: string;
  sourceDocumentId?: string;
  selected: boolean;
  createdByAgentId?: string;
}

export type CanvasElementType =
  | "shape"
  | "connector"
  | "text"
  | "frame"
  | "note"
  | "image"
  | "group";

export interface CanvasElementPayload {
  content?: string;
  shapeType?: "rectangle" | "ellipse" | "diamond" | "triangle";
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  textColor?: string;
  fontSize?: number;
  sourceId?: string;
  sourceType?: "document" | "issue";
  connectorStart?: ConnectorEndpoint;
  connectorEnd?: ConnectorEndpoint;
  connectorPath?: string;
  opacity?: number;
  [key: string]: unknown;
}

export interface ConnectorEndpoint {
  elementId: string;
  anchor: "top" | "right" | "bottom" | "left" | "center";
}

export interface MakeStandaloneResult {
  newDocumentId: string;
  newDocumentTitle: string;
  elementsMoved: number;
}
