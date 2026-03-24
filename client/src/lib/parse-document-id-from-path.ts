/** UUID v4 pattern — company document routes use real UUIDs in the path. */
const STANDALONE_DOC_ID_RE =
  /\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i;

const DOC_UUID_STRICT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Extract company document id from locations like `/:prefix/documents/:documentId`.
 * Does not match `/documents/graph`.
 */
export function parseDocumentIdFromPathname(pathname: string): string | undefined {
  const m = pathname.match(STANDALONE_DOC_ID_RE);
  return m?.[1]?.toLowerCase();
}

/** `?document=<uuid>` on chat (or other) routes. */
export function parseDocumentIdFromSearch(search: string): string | undefined {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const raw = new URLSearchParams(q).get("document")?.trim();
  if (!raw || !DOC_UUID_STRICT.test(raw)) return undefined;
  return raw.toLowerCase();
}
