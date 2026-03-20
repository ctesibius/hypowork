import type { Edge, Node } from "@xyflow/react";

const STORAGE_VERSION = 1 as const;

export type StoredCompanyCanvas = {
  v: typeof STORAGE_VERSION;
  nodes: Node[];
  edges: Edge[];
};

function key(companyId: string) {
  return `paperclip:company-canvas:v${STORAGE_VERSION}:${companyId}`;
}

export function loadCompanyCanvas(companyId: string): Pick<StoredCompanyCanvas, "nodes" | "edges"> {
  if (typeof window === "undefined") return { nodes: [], edges: [] };
  try {
    const raw = window.localStorage.getItem(key(companyId));
    if (!raw) return { nodes: [], edges: [] };
    const parsed = JSON.parse(raw) as Partial<StoredCompanyCanvas>;
    if (parsed.v !== STORAGE_VERSION) return { nodes: [], edges: [] };
    return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export function saveCompanyCanvas(
  companyId: string,
  data: Pick<StoredCompanyCanvas, "nodes" | "edges">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredCompanyCanvas = { v: STORAGE_VERSION, nodes: data.nodes, edges: data.edges };
    window.localStorage.setItem(key(companyId), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearCompanyCanvas(companyId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(companyId));
  } catch {
    /* ignore */
  }
}
