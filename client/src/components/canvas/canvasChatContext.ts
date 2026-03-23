import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeContextForChat } from "../../api/chat";

export type CanvasNeighborContext = {
  selectedNode: Node;
  neighborNodes: Node[];
  connectedDocIds: string[];
};

/** Build selection + 1-hop neighbors + linked doc ids from the graph (no React Flow hook). */
export function buildCanvasNeighborContext(
  nodes: Node[],
  edges: Edge[],
  selectedNodeId: string | null,
): CanvasNeighborContext | null {
  if (!selectedNodeId) return null;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const connectedIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source === selectedNodeId) connectedIds.add(edge.target);
    if (edge.target === selectedNodeId) connectedIds.add(edge.source);
  }

  const neighborNodes = nodes.filter((n) => connectedIds.has(n.id) && n.id !== selectedNodeId);
  const connectedDocIds: string[] = [];

  for (const n of [selectedNode, ...neighborNodes]) {
    const docRef = n.data as { documentId?: string };
    if (docRef?.documentId) connectedDocIds.push(docRef.documentId);
  }

  return { selectedNode, neighborNodes, connectedDocIds };
}

export function toChatNodeContext(ctx: CanvasNeighborContext | null): CanvasNodeContextForChat | null {
  if (!ctx) return null;
  return {
    selectedNodeType: String(ctx.selectedNode.type ?? "unknown"),
    selectedNodeData: (ctx.selectedNode.data ?? {}) as Record<string, unknown>,
    neighborNodeTypes: ctx.neighborNodes.map((n) => String(n.type ?? "unknown")),
    neighborNodeData: ctx.neighborNodes.map((n) => (n.data ?? {}) as Record<string, unknown>),
    connectedDocIds: ctx.connectedDocIds,
  };
}

/** Compact summary of the board for whole-canvas AI scope. */
export function serializeCanvasGraphForChat(
  documentTitle: string | null | undefined,
  documentId: string | null | undefined,
  nodes: Node[],
  edges: Edge[],
): string {
  const head = documentId
    ? `Document: "${documentTitle?.trim() || "Untitled"}" (id ${documentId})`
    : "Company canvas (no single document id)";
  const nodeLines = nodes.map((n) => {
    const d = n.data ?? {};
    const snippet = JSON.stringify(d).slice(0, 400);
    return `- [${n.id}] type=${n.type ?? "?"} pos=${Math.round(n.position?.x ?? 0)},${Math.round(n.position?.y ?? 0)} data=${snippet}${snippet.length >= 400 ? "…" : ""}`;
  });
  const edgeLines = edges.map((e) => `- ${e.source} → ${e.target} (${e.type ?? "default"})`);
  return [head, "", "Nodes:", ...nodeLines, "", "Edges:", ...edgeLines].join("\n");
}
