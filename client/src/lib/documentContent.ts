import {
  EMPTY_CANVAS_BODY,
  extractPrimaryMarkdownFromCanvasGraph,
  isStoredBodyCanvasGraph,
} from "@paperclipai/shared";

/** Canonical prose for editors (Plate) and canvas primary card — never a combined JSON graph after migration. */
export function getProseBody(doc: { body?: string | null; kind?: string | null } | null | undefined): string {
  if (!doc) return "";
  const raw = doc.body ?? "";
  if (isStoredBodyCanvasGraph(raw)) {
    return extractPrimaryMarkdownFromCanvasGraph(raw);
  }
  return raw;
}

/** React Flow graph JSON for the canvas surface; legacy rows may still store the graph in `body`. */
export function getCanvasGraphJson(doc: {
  id: string;
  body?: string | null;
  kind?: string | null;
  canvasGraph?: string | null;
}): string {
  const cg = doc.canvasGraph;
  if (cg != null && String(cg).trim()) return String(cg);
  if (doc.kind === "canvas" && isStoredBodyCanvasGraph(doc.body ?? "")) {
    return doc.body ?? EMPTY_CANVAS_BODY;
  }
  return EMPTY_CANVAS_BODY;
}
