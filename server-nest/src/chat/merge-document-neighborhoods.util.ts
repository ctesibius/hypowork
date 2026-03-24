import type { Db } from "@paperclipai/db";
import type { RAGContext } from "./chat.types.js";
import { buildDocumentNeighborhoodRagLinks } from "./document-neighborhood-rag.util.js";
import {
  CHAT_MAX_CONTEXT_REFS,
  CHAT_MAX_MERGED_DOCUMENT_LINKS,
  CHAT_MAX_NEIGHBORS_PER_CENTER,
} from "./chat-context-limits.js";

/**
 * Union 1-hop neighborhoods for multiple center documents, dedupe by document id, cap total rows.
 */
export async function mergeDocumentNeighborhoodsForCenters(
  db: Db,
  companyId: string,
  centerDocumentIds: string[],
): Promise<RAGContext["documentLinks"]> {
  const uniqueCenters = [...new Set(centerDocumentIds.filter(Boolean))].slice(0, CHAT_MAX_CONTEXT_REFS);
  if (uniqueCenters.length === 0) return [];

  const byId = new Map<string, { id: string; title: string; excerpt: string; score: number }>();

  for (const centerId of uniqueCenters) {
    try {
      const batch = await buildDocumentNeighborhoodRagLinks(
        db,
        companyId,
        centerId,
        CHAT_MAX_NEIGHBORS_PER_CENTER,
      );
      for (const link of batch) {
        const prev = byId.get(link.id);
        const score = Math.max(prev?.score ?? 0, link.score ?? 0);
        if (!prev || score > prev.score) {
          byId.set(link.id, {
            id: link.id,
            title: link.title,
            excerpt: link.excerpt,
            score,
          });
        }
      }
    } catch {
      // skip bad center; other centers still contribute
    }
  }

  const merged = [...byId.values()].sort((a, b) => b.score - a.score);
  return merged.slice(0, CHAT_MAX_MERGED_DOCUMENT_LINKS).map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    score: r.score,
  }));
}
