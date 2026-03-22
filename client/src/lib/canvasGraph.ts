import type { Edge, Node } from "@xyflow/react";

export const EMPTY_CANVAS_BODY = '{"nodes":[],"edges":[]}';

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
