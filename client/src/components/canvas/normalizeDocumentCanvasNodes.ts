import type { Node } from "@xyflow/react";

/** Data for the Hypopedia-style “page on canvas” card (host document or freeform page note). */
export type DocPageCanvasData = {
  body: string;
  title?: string;
  documentId?: string;
  /** Host document body card (prose → canvas seed). */
  isPrimaryDocument?: boolean;
  /** Collapse body; header stays visible. */
  collapsed?: boolean;
  /** Card width in px (clamped in UI). Persisted in canvas graph JSON. */
  cardWidth?: number;
  /** Non-primary page cards: when true, Plate is editable (slash `/` menu). */
  canvasEditing?: boolean;
  /**
   * Body vertical layout: `fit` grows with content; `partial` uses `cardBodyMaxPx` scroll area.
   * Omitted / `fit` = legacy full-height card body.
   */
  bodyHeightMode?: "fit" | "partial";
  /** Max height (px) of scrollable body when `bodyHeightMode === "partial"`. */
  cardBodyMaxPx?: number;
};

/**
 * Upgrade legacy prose→canvas `sticky` seeds to `docPage`, and fill missing fields on `docPage` nodes.
 */
export function normalizeDocumentCanvasNodes(
  nodes: Node[],
  documentId: string,
  docTitle: string | null | undefined,
  /** Injected canonical prose for the primary card (SSOT: `latest_body`); overrides empty stored `data.body`. */
  proseMarkdown?: string,
): Node[] {
  const fallbackTitle = docTitle?.trim() || "Untitled";
  const seedId = `prose-seed-${documentId}`;

  /** Any host docPage explicitly marked primary (legacy graphs may mark every host card `false`, which blocked SSOT injection). */
  const hasExplicitPrimaryForHost = nodes.some((n) => {
    if (n.type !== "docPage") return false;
    const d = (n.data ?? {}) as DocPageCanvasData;
    if (d.isPrimaryDocument !== true) return false;
    const resolved = d.documentId ?? documentId;
    return resolved === documentId;
  });

  let canonicalHostNodeId: string | null = null;
  if (!hasExplicitPrimaryForHost) {
    if (nodes.some((n) => n.type === "docPage" && n.id === seedId)) {
      canonicalHostNodeId = seedId;
    } else {
      for (const n of nodes) {
        if (n.type !== "docPage") continue;
        const d = (n.data ?? {}) as DocPageCanvasData;
        if ((d.documentId ?? documentId) === documentId) {
          canonicalHostNodeId = n.id;
          break;
        }
      }
    }
  }

  return nodes.map((n) => {
    if (n.type === "sticky" && n.id === seedId) {
      const body = (n.data as { body?: string })?.body ?? "";
      return {
        ...n,
        type: "docPage",
        data: {
          body,
          title: fallbackTitle,
          documentId,
          isPrimaryDocument: true,
        } satisfies DocPageCanvasData,
      };
    }
    if (n.type === "docPage") {
      const d = (n.data ?? {}) as DocPageCanvasData;
      const resolvedId = d.documentId ?? documentId;
      const hostMatch = resolvedId === documentId;

      let isPrimary: boolean;
      if (hasExplicitPrimaryForHost) {
        if (!hostMatch) isPrimary = false;
        else if (d.isPrimaryDocument === false) isPrimary = false;
        else if (d.isPrimaryDocument === true) isPrimary = true;
        else isPrimary = true;
      } else {
        isPrimary = hostMatch && n.id === canonicalHostNodeId;
      }

      const body =
        isPrimary && proseMarkdown !== undefined
          ? proseMarkdown
          : (d.body ?? "");
      return {
        ...n,
        data: {
          body,
          title: d.title?.trim() || fallbackTitle,
          documentId: resolvedId,
          isPrimaryDocument: isPrimary,
          collapsed: d.collapsed,
          cardWidth: d.cardWidth,
          canvasEditing: d.canvasEditing,
          bodyHeightMode: d.bodyHeightMode,
          cardBodyMaxPx: d.cardBodyMaxPx,
        } satisfies DocPageCanvasData,
      };
    }
    return n;
  });
}
