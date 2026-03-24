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

/** Minimal fields for PLC stage rollup on canvas (matches `SfWorkOrder`). */
export type PlcStageWorkOrderRef = {
  plcStageId: string | null;
  status: string;
};

export type PlcStageAggregateKind = "empty" | "active" | "blocked" | "complete";

/**
 * Roll up work orders tagged to a PLC stage (`plc_stage_id` === canvas `stage` node id).
 * Priority: blocked → active (todo/in_progress) → complete (all done/cancelled) → empty.
 */
export function aggregatePlcStageFromWorkOrders(
  workOrders: PlcStageWorkOrderRef[] | undefined,
  stageNodeId: string,
): { kind: PlcStageAggregateKind; count: number } {
  if (!workOrders?.length) return { kind: "empty", count: 0 };
  const tagged = workOrders.filter((w) => w.plcStageId === stageNodeId);
  if (tagged.length === 0) return { kind: "empty", count: 0 };
  if (tagged.some((w) => w.status === "blocked")) return { kind: "blocked", count: tagged.length };
  if (tagged.some((w) => w.status === "todo" || w.status === "in_progress")) {
    return { kind: "active", count: tagged.length };
  }
  if (tagged.every((w) => w.status === "done" || w.status === "cancelled")) {
    return { kind: "complete", count: tagged.length };
  }
  return { kind: "active", count: tagged.length };
}

const SF_LIFECYCLE_PREFIX = "sf-lifecycle-";

export type PlcStageInfo = {
  id: string;
  label: string;
  kind: "gate" | "phase" | "checkpoint";
};

/**
 * Idempotent: adds PLC **stage** nodes + a **sticky** with a deep link to Design Factory.
 * Skips nodes whose ids already exist so users can run the action more than once safely.
 * Uses the passed `stages` array; falls back to the old 5-stage sequence if none provided.
 */
export function mergeDesignFactoryLifecycleIntoCanvas(
  body: string,
  projectUrlRef: string,
  stages?: PlcStageInfo[],
): string {
  const { nodes, edges } = parseCanvasBody(body);
  const existing = new Set(nodes.map((n) => n.id));
  const layoutStages = stages?.length
    ? stages.map((s) => ({ id: s.id, label: s.label }))
    : [
        { id: "sf-lifecycle-0", label: "Kickoff" },
        { id: "sf-lifecycle-1", label: "SRR" },
        { id: "sf-lifecycle-2", label: "PDR" },
        { id: "sf-lifecycle-3", label: "CDR" },
        { id: "sf-lifecycle-4", label: "TRR" },
      ];
  const extraNodes: Node[] = [];
  const extraEdges: Edge[] = [];
  let prevId: string | null = null;
  const x = 72;
  const y0 = 96;
  const dy = 96;
  for (let i = 0; i < layoutStages.length; i++) {
    const { id, label } = layoutStages[i]!;
    if (existing.has(id)) {
      prevId = id;
      continue;
    }
    extraNodes.push({
      id,
      type: "stage",
      position: { x, y: y0 + i * dy },
      data: { label },
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
