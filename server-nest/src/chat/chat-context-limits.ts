/** Caps for multi-document neighborhood RAG (tunable without schema changes). */
export const CHAT_MAX_CONTEXT_REFS = 8;
/** Max graph neighbors fetched per center document (before cross-ref merge). */
export const CHAT_MAX_NEIGHBORS_PER_CENTER = 18;
/** Max distinct document rows passed into the prompt after merge/dedupe. */
export const CHAT_MAX_MERGED_DOCUMENT_LINKS = 36;
