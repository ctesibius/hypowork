/** Truncate document body for RAG context (prose or canvas JSON). */
export function excerptDocumentBodyForRag(latestBody: string, kind: string | null | undefined): string {
  const k = kind === "canvas" ? "canvas" : "prose";
  if (!latestBody?.trim()) return "";
  if (k === "canvas") {
    try {
      const o = JSON.parse(latestBody) as { nodes?: Array<{ data?: { body?: string } }> };
      const parts = (o.nodes ?? [])
        .map((n) => (typeof n.data?.body === "string" ? n.data.body.trim() : ""))
        .filter(Boolean);
      const t = parts.join("\n").trim();
      return t.slice(0, 500);
    } catch {
      return latestBody.slice(0, 400);
    }
  }
  return latestBody.slice(0, 500);
}
