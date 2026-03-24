/** Max characters per document excerpt passed into chat RAG (prose markdown). */
export const RAG_PROSE_EXCERPT_MAX_CHARS = 12_000;
/** Max characters when aggregating canvas node text bodies for RAG. */
export const RAG_CANVAS_AGGREGATE_MAX_CHARS = 8_000;
/** Fallback when canvas JSON parse fails. */
export const RAG_CANVAS_FALLBACK_MAX_CHARS = 4_000;

/** Truncate document body for RAG context (prose or canvas JSON). */
export function excerptDocumentBodyForRag(latestBody: string, kind: string | null | undefined): string {
  const k = kind === "canvas" ? "canvas" : "prose";
  if (!latestBody?.trim()) return "";
  let out: string;
  if (k === "canvas") {
    try {
      const o = JSON.parse(latestBody) as { nodes?: Array<{ data?: { body?: string } }> };
      const parts = (o.nodes ?? [])
        .map((n) => (typeof n.data?.body === "string" ? n.data.body.trim() : ""))
        .filter(Boolean);
      const t = parts.join("\n").trim();
      out = t.slice(0, RAG_CANVAS_AGGREGATE_MAX_CHARS);
    } catch {
      out = latestBody.slice(0, RAG_CANVAS_FALLBACK_MAX_CHARS);
    }
  } else {
    out = latestBody.slice(0, RAG_PROSE_EXCERPT_MAX_CHARS);
  }

  return out;
}
