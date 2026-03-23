/**
 * Canvas graph JSON helpers — shared by server and client.
 * SSOT: canonical prose lives in `latest_body`; graph in `canvas_graph_json` must not duplicate primary docPage body.
 */

export const EMPTY_CANVAS_BODY = '{"nodes":[],"edges":[]}';

/** True if body is empty or JSON canvas graph `{ nodes: [], edges: [] }` (legacy combined storage). */
export function isStoredBodyCanvasGraph(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  try {
    const o = JSON.parse(t) as { nodes?: unknown; edges?: unknown };
    if (typeof o !== "object" || o === null || Array.isArray(o)) return false;
    return Array.isArray(o.nodes) && Array.isArray(o.edges);
  } catch {
    return false;
  }
}

/** Canonical prose for a canvas document: primary `docPage` only (not stickies). */
export function extractPrimaryDocPageMarkdown(graphJson: string, documentId: string): string {
  const t = graphJson.trim();
  if (!t) return "";
  try {
    const o = JSON.parse(t) as { nodes?: unknown };
    if (!Array.isArray(o.nodes)) return "";
    const id = documentId.trim();
    for (const n of o.nodes as Array<{
      type?: string;
      data?: { body?: string; documentId?: string; isPrimaryDocument?: boolean };
    }>) {
      if (n.type !== "docPage") continue;
      const d = n.data ?? {};
      if (d.isPrimaryDocument === true || (d.documentId != null && String(d.documentId) === id)) {
        return typeof d.body === "string" ? d.body : "";
      }
    }
    return "";
  } catch {
    return "";
  }
}

/** Extract markdown for prose view / migration from a legacy combined canvas graph body. */
export function extractPrimaryMarkdownFromCanvasGraph(body: string): string {
  const t = body.trim();
  if (!t) return "";
  try {
    const o = JSON.parse(t) as { nodes?: unknown };
    if (!Array.isArray(o.nodes)) return "";
    const texts: string[] = [];
    for (const n of o.nodes as Array<{ type?: string; data?: { body?: string } }>) {
      if (
        (n.type === "sticky" || n.type === "sketch" || n.type === "docPage") &&
        typeof n.data?.body === "string" &&
        n.data.body.trim().length > 0
      ) {
        texts.push(n.data.body.trim());
      }
    }
    return texts.join("\n\n").trim();
  } catch {
    return "";
  }
}

type DocPageData = {
  body?: string;
  title?: string;
  documentId?: string;
  isPrimaryDocument?: boolean;
};

/** Clear primary docPage `data.body` in stored graph JSON (prose SSOT is `latest_body`). */
export function stripPrimaryDocPageBodyFromGraph(graphJson: string, documentId: string): string {
  const t = graphJson.trim();
  if (!t) return graphJson;
  try {
    const o = JSON.parse(t) as { nodes?: unknown[]; edges?: unknown[] };
    if (!Array.isArray(o.nodes)) return graphJson;
    const id = documentId.trim();
    const nodes = o.nodes.map((raw) => {
      const n = raw as { type?: string; data?: DocPageData };
      if (n.type !== "docPage") return raw;
      const d = n.data ?? {};
      const isPrimary = d.isPrimaryDocument === true || (d.documentId != null && String(d.documentId) === id);
      if (!isPrimary) return raw;
      return {
        ...n,
        data: {
          ...d,
          body: "",
        },
      };
    });
    return JSON.stringify({
      nodes,
      edges: Array.isArray(o.edges) ? o.edges : [],
    });
  } catch {
    return graphJson;
  }
}

/** Seed a canvas graph with a primary docPage (for kind switch); caller should strip primary body before persist. */
export function embedProseMarkdownInCanvasGraph(
  markdown: string,
  documentId: string,
  docTitle: string | null,
): string {
  const nodeId = `prose-seed-${documentId}`;
  const title = docTitle?.trim() || "Untitled";
  return JSON.stringify({
    nodes: [
      {
        id: nodeId,
        type: "docPage",
        position: { x: 80, y: 80 },
        data: {
          body: markdown,
          title,
          documentId,
          isPrimaryDocument: true,
        },
      },
    ],
    edges: [],
  });
}

/**
 * Split legacy POST/PATCH body that stores the full graph in `body` into prose + stripped graph.
 * If `combinedBody` is plain markdown (not a graph), returns that prose and `graphJson: null` (caller seeds empty graph for canvas).
 */
export function splitLegacyCombinedCanvasBody(
  combinedBody: string,
  documentId: string,
): { prose: string; graphJson: string | null } {
  if (!isStoredBodyCanvasGraph(combinedBody)) {
    return { prose: combinedBody, graphJson: null };
  }
  const prose = extractPrimaryMarkdownFromCanvasGraph(combinedBody);
  const graphJson = stripPrimaryDocPageBodyFromGraph(combinedBody, documentId);
  return { prose, graphJson };
}
