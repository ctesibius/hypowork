import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { documentLinks, documents, issueDocuments } from "@paperclipai/db";

/** DB or Drizzle transaction — same surface needed for link extraction writes. */
export type DocumentLinkDb = Pick<Db, "delete" | "insert" | "select">;

export type DocumentLinkKind = "wikilink" | "mention";

export type ExtractedDocRef = {
  raw: string;
  kind: DocumentLinkKind;
  /** Target key: UUID string or title / @doc/ path fragment. */
  ref: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Obsidian-style [[page]] / [[page|alias]] / [[page#heading]] */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]]*)?(?:\|[^\]]+)?\]\]/g;

/** @doc/title-without-spaces (v1: non-whitespace run after @doc/) */
const MENTION_DOC_RE = /@doc\/(\S+)/g;

/** @<uuid> */
const MENTION_UUID_RE = /@([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/**
 * Parse markdown for wikilinks and @-references (no DB).
 */
export function extractMarkdownDocumentReferences(markdown: string): ExtractedDocRef[] {
  const seen = new Set<string>();
  const out: ExtractedDocRef[] = [];

  const push = (raw: string, kind: DocumentLinkKind, ref: string) => {
    const key = `${kind}\0${raw}\0${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ raw, kind, ref: ref.trim() });
  };

  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(markdown)) !== null) {
    const inner = m[1]?.trim() ?? "";
    if (inner.length === 0) continue;
    push(m[0], "wikilink", inner);
  }

  MENTION_DOC_RE.lastIndex = 0;
  while ((m = MENTION_DOC_RE.exec(markdown)) !== null) {
    const inner = m[1]?.trim() ?? "";
    if (inner.length === 0) continue;
    push(m[0], "mention", inner);
  }

  MENTION_UUID_RE.lastIndex = 0;
  while ((m = MENTION_UUID_RE.exec(markdown)) !== null) {
    const id = m[1]?.toLowerCase() ?? "";
    push(m[0], "mention", id);
  }

  return out;
}

/**
 * Build synthetic markdown from a canvas JSON graph so wikilinks / @-refs in note cards
 * index into `document_links`. Also adds `@<uuid>` lines for doc-ref cards.
 */
export function syntheticMarkdownFromCanvasGraphBody(body: string): string {
  const t = body.trim();
  if (!t) return "";
  try {
    const o = JSON.parse(t) as { nodes?: unknown[] };
    if (!Array.isArray(o.nodes)) return "";
    const parts: string[] = [];
    for (const n of o.nodes as Array<{ type?: string; data?: Record<string, unknown> }>) {
      const ty = n.type;
      const d = n.data ?? {};
      if (
        (ty === "sticky" || ty === "sketch" || ty === "docPage") &&
        typeof d.body === "string" &&
        d.body.trim().length > 0
      ) {
        parts.push(d.body.trim());
      }
      if (ty === "docRef" && typeof d.documentId === "string" && isUuid(d.documentId)) {
        parts.push(`@${d.documentId}`);
      }
    }
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

async function listStandaloneDocumentIdsAndTitles(db: DocumentLinkDb, companyId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
    })
    .from(documents)
    .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
    .where(and(eq(documents.companyId, companyId), isNull(issueDocuments.id)));
}

async function resolveRefToTargetId(
  ref: string,
  idAndTitles: { id: string; title: string | null }[],
): Promise<string | null> {
  const trimmed = ref.trim();
  if (trimmed.length === 0) return null;

  if (isUuid(trimmed)) {
    const row = idAndTitles.find((r) => r.id === trimmed);
    return row ? row.id : null;
  }

  const lower = trimmed.toLowerCase();
  const hit = idAndTitles.find((r) => (r.title ?? "").trim().toLowerCase() === lower);
  return hit?.id ?? null;
}

/** Delete all extracted links for a source and insert fresh rows. */
export async function replaceDocumentLinksForSource(
  db: DocumentLinkDb,
  input: {
    companyId: string;
    sourceDocumentId: string;
    /** Canonical prose / markdown (`documents.latest_body`). */
    body: string;
    /** Stored React Flow JSON; wikilinks from cards + docRefs merged with prose for indexing when kind is canvas. */
    canvasGraphJson?: string | null;
    documentKind?: "prose" | "canvas";
  },
): Promise<void> {
  await db.delete(documentLinks).where(eq(documentLinks.sourceDocumentId, input.sourceDocumentId));

  const prose = input.body.trim();
  let markdownSource = prose;
  if (input.documentKind === "canvas") {
    const syn = input.canvasGraphJson?.trim()
      ? syntheticMarkdownFromCanvasGraphBody(input.canvasGraphJson)
      : "";
    markdownSource = [prose, syn].filter((s) => s.length > 0).join("\n\n");
  }

  const extracted = extractMarkdownDocumentReferences(markdownSource);

  if (extracted.length === 0) return;

  const idAndTitles = await listStandaloneDocumentIdsAndTitles(db, input.companyId);

  const rows: {
    companyId: string;
    sourceDocumentId: string;
    targetDocumentId: string | null;
    rawReference: string;
    linkKind: DocumentLinkKind;
  }[] = [];

  for (const e of extracted) {
    const targetId = await resolveRefToTargetId(e.ref, idAndTitles);
    rows.push({
      companyId: input.companyId,
      sourceDocumentId: input.sourceDocumentId,
      targetDocumentId: targetId,
      rawReference: e.raw,
      linkKind: e.kind,
    });
  }

  if (rows.length === 0) return;

  await db.insert(documentLinks).values(rows);
}

export async function listOutgoingDocumentLinks(db: Db, companyId: string, sourceDocumentId: string) {
  return db
    .select({
      targetDocumentId: documentLinks.targetDocumentId,
      rawReference: documentLinks.rawReference,
      linkKind: documentLinks.linkKind,
    })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.companyId, companyId),
        eq(documentLinks.sourceDocumentId, sourceDocumentId),
      ),
    );
}

export async function listIncomingDocumentLinks(db: Db, companyId: string, targetDocumentId: string) {
  return db
    .select({
      sourceDocumentId: documentLinks.sourceDocumentId,
      rawReference: documentLinks.rawReference,
      linkKind: documentLinks.linkKind,
    })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.companyId, companyId),
        eq(documentLinks.targetDocumentId, targetDocumentId),
      ),
    );
}

/** 1-hop neighborhood: document + distinct linked targets + distinct sources linking in (resolved targets only for out/in edges). */
export async function getDocumentNeighborhoodIds(
  db: Db,
  companyId: string,
  documentId: string,
  maxIds = 50,
): Promise<string[]> {
  const outRows = await db
    .select({ tid: documentLinks.targetDocumentId })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.companyId, companyId),
        eq(documentLinks.sourceDocumentId, documentId),
        isNotNull(documentLinks.targetDocumentId),
      ),
    );

  const inRows = await db
    .select({ sid: documentLinks.sourceDocumentId })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.companyId, companyId),
        eq(documentLinks.targetDocumentId, documentId),
      ),
    );

  const ids = new Set<string>([documentId]);
  for (const r of outRows) {
    if (r.tid) ids.add(r.tid);
  }
  for (const r of inRows) {
    ids.add(r.sid);
  }
  return Array.from(ids).slice(0, maxIds);
}

/** Verify standalone company document exists (not issue-attached). */
export async function assertStandaloneCompanyDocument(
  db: Db,
  companyId: string,
  documentId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: documents.id })
    .from(documents)
    .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.companyId, companyId),
        isNull(issueDocuments.id),
      ),
    )
    .then((r) => r[0] ?? null);
  return row !== null;
}
