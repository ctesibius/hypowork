import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { documents, issueDocuments } from "@paperclipai/db";
import { getDocumentNeighborhoodIds } from "@paperclipai/server/services/document-link-support";
import type { RAGContext } from "./chat.types.js";
import { excerptDocumentBodyForRag } from "./document-rag-excerpt.util.js";

export async function buildDocumentNeighborhoodRagLinks(
  db: Db,
  companyId: string,
  centerDocumentId: string,
  maxNeighbors = 24,
): Promise<RAGContext["documentLinks"]> {
  const ids = await getDocumentNeighborhoodIds(db, companyId, centerDocumentId, maxNeighbors);
  const unique = [...new Set([centerDocumentId, ...ids])];
  if (unique.length === 0) return [];

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      latestBody: documents.latestBody,
      kind: documents.kind,
    })
    .from(documents)
    .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
    .where(
      and(eq(documents.companyId, companyId), inArray(documents.id, unique), isNull(issueDocuments.id)),
    );

  return rows.map((r) => ({
    id: r.id,
    title: r.title?.trim() || "(untitled)",
    excerpt: excerptDocumentBodyForRag(r.latestBody, r.kind),
    score: r.id === centerDocumentId ? 2 : 1,
  }));
}
