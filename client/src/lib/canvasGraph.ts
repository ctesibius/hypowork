import type { Edge, Node } from "@xyflow/react";
import {
  EMPTY_CANVAS_BODY,
  extractPrimaryDocPageMarkdown,
  extractPrimaryMarkdownFromCanvasGraph as extractPrimaryMarkdownFromCanvasGraphShared,
  isStoredBodyCanvasGraph,
  stripPrimaryDocPageBodyFromGraph,
} from "@paperclipai/shared";

export { EMPTY_CANVAS_BODY, extractPrimaryDocPageMarkdown };

/** True if body is empty or JSON canvas graph `{ nodes: [], edges: [] }` (not prose markdown). */
export function isCanvasGraphDocumentBody(body: string | undefined | null): boolean {
  return isStoredBodyCanvasGraph(body ?? "");
}

export function parseCanvasBody(body: string | undefined | null): { nodes: Node[]; edges: Edge[] } {
  if (!body?.trim()) {
    return { nodes: [], edges: [] };
  }
  try {
    const o = JSON.parse(body) as { nodes?: unknown; edges?: unknown };
    return {
      nodes: Array.isArray(o.nodes) ? (o.nodes as Node[]) : [],
      edges: Array.isArray(o.edges) ? (o.edges as Edge[]) : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export function serializeCanvasGraph(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({ nodes, edges });
}

const SF_LIFECYCLE_PREFIX = "sf-lifecycle-";

/**
 * Idempotent: adds PLC-style **stage** nodes + a **sticky** with a deep link to Design Factory.
 * Skips nodes whose ids already exist so users can run the action more than once safely.
 */
export function mergeDesignFactoryLifecycleIntoCanvas(
  body: string,
  projectUrlRef: string,
): string {
  const { nodes, edges } = parseCanvasBody(body);
  const existing = new Set(nodes.map((n) => n.id));
  const stages = ["Kickoff", "SRR", "PDR", "CDR", "TRR"];
  const extraNodes: Node[] = [];
  const extraEdges: Edge[] = [];
  let prevId: string | null = null;
  const x = 72;
  const y0 = 96;
  const dy = 96;
  for (let i = 0; i < stages.length; i++) {
    const id = `${SF_LIFECYCLE_PREFIX}${i}`;
    if (existing.has(id)) {
      prevId = id;
      continue;
    }
    extraNodes.push({
      id,
      type: "stage",
      position: { x, y: y0 + i * dy },
      data: { label: stages[i]! },
    });
    if (prevId) {
      extraEdges.push({
        id: `e-${prevId}-${id}`,
        source: prevId,
        target: id,
        type: "smoothstep",
      });
    }
    prevId = id;
  }
  const stickyId = `${SF_LIFECYCLE_PREFIX}note`;
  if (!existing.has(stickyId)) {
    extraNodes.push({
      id: stickyId,
      type: "sticky",
      position: { x: 300, y: y0 },
      data: {
        body: `Design Factory\n/projects/${projectUrlRef}/factory\n\nRefinery → Foundry → Planner → Validator`,
      },
    });
  }
  return serializeCanvasGraph([...nodes, ...extraNodes], [...edges, ...extraEdges]);
}

/**
 * For prose view when `kind === "prose"` but canonical storage is still a canvas graph (view switch, no migration).
 * Mirrors server SSOT.
 */
export function extractPrimaryMarkdownFromCanvasGraph(body: string): string {
  return extractPrimaryMarkdownFromCanvasGraphShared(body);
}

/** Strip primary docPage body before persisting `canvasGraph` JSON (prose lives in `body` / `latest_body`). */
export function stripPrimaryMarkdownFromCanvasGraph(graphJson: string, documentId: string): string {
  return stripPrimaryDocPageBodyFromGraph(graphJson, documentId);
}

/** Merge edited prose into the primary `docPage` of a stored canvas graph; preserves other nodes/edges. */
export function mergeProseMarkdownIntoCanvasGraph(
  graphJson: string,
  documentId: string,
  title: string | null | undefined,
  markdown: string,
): string {
  const t = graphJson.trim();
  if (!t) return graphJson;
  try {
    const o = JSON.parse(t) as { nodes?: Node[]; edges?: Edge[] };
    if (!Array.isArray(o.nodes)) return graphJson;
    const nextTitle = title?.trim() || "Untitled";
    let found = false;
    const nodes = (o.nodes as Node[]).map((n) => {
      if (n.type !== "docPage") return n;
      const d = (n.data ?? {}) as {
        body?: string;
        title?: string;
        documentId?: string;
        isPrimaryDocument?: boolean;
      };
      const isPrimary = d.isPrimaryDocument === true || d.documentId === documentId;
      if (!isPrimary) return n;
      found = true;
      return {
        ...n,
        data: {
          ...d,
          body: markdown,
          title: nextTitle,
          documentId: d.documentId ?? documentId,
          isPrimaryDocument: true,
        },
      };
    });
    if (!found) return graphJson;
    return JSON.stringify({ nodes, edges: Array.isArray(o.edges) ? o.edges : [] });
  } catch {
    return graphJson;
  }
}
