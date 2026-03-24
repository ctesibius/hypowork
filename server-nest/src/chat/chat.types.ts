/**
 * Chat Types - Phase 1.6 chat with RAG + citations
 *
 * Provides:
 * - Thread management (create, list, get)
 * - Message persistence
 * - RAG from Vault + Mem0
 * - Citations from company documents
 * - Ask employee (agent) queries
 */

/**
 * Typed attachment for RAG context expansion (per thread).
 * MVP: `document` only. Reserved for future: `issue`, `project`, `goal`, etc.
 */
export type ThreadContextRef =
  | { type: "document"; id: string }
  // Placeholder union arms — implement resolvers when adding issue/project RAG:
  // | { type: "issue"; id: string }
  // | { type: "project"; id: string }
  ;

export interface ChatThread {
  id: string;
  companyId: string;
  title: string;
  type: ThreadType;
  scope?: ThreadScope;
  agentId?: string;  // If scoped to an agent
  documentId?: string;  // If scoped to a document
  /** Board project UUID — Software Factory RAG scope (Phase 2). */
  projectId?: string;
  /** Per-thread context anchors (document neighborhoods, future entity types). */
  contextRefs?: ThreadContextRef[];
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string;
}

export type ThreadType = "general" | "document" | "agent" | "search";
export type ThreadScope = "company" | "document" | "agent";

export interface ChatMessage {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
  contextUsed?: string[];  // Memory/vault entry IDs used
  model?: string;
  /** Which prompt version generated this assistant response (for rating attribution) */
  promptVersionId?: string;
  createdAt: string;
  attachments?: Attachment[];
}

export type MessageRole = "user" | "assistant" | "system";

export interface Citation {
  sourceType: CitationSourceType;
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  excerpt: string;
  score?: number;
}

export type CitationSourceType =
  | "memory"     // From Mem0 memory
  | "vault"      // From Vault entries
  | "document"   // From company documents
  | "canvas";    // From canvas nodes

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  url: string;
}

export type AttachmentType = "document" | "image" | "link";

export interface ChatResponse {
  threadId: string;
  message: ChatMessage;
  suggestions?: string[];
}

export interface CreateThreadDto {
  title: string;
  type?: ThreadType;
  scope?: ThreadScope;
  agentId?: string;
  documentId?: string;
  projectId?: string;
  contextRefs?: ThreadContextRef[];
}

/** PATCH body for thread metadata (context attachments, scope). */
export interface PatchThreadDto {
  title?: string;
  type?: ThreadType;
  scope?: ThreadScope;
  /** Set to null to clear primary document filter. */
  documentId?: string | null;
  contextRefs?: ThreadContextRef[];
}

export interface SendMessageDto {
  content: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Optional link-scoped RAG context passed from canvas node selection */
export interface CanvasNodeContextForChat {
  selectedNodeType: string;
  selectedNodeData: Record<string, unknown>;
  neighborNodeTypes: string[];
  neighborNodeData: Record<string, unknown>[];
  connectedDocIds: string[];
}

export interface SendMessageWithContextDto extends SendMessageDto {
  nodeContext?: CanvasNodeContextForChat;
}

export interface RAGContext {
  memories: Array<{
    id: string;
    content: string;
    score: number;
  }>;
  vaultEntries: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
  }>;
  documentLinks: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
  }>;
}

export interface StreamingResponse {
  threadId: string;
  messageId: string;
  delta: string;
  done: boolean;
  citations?: Citation[];
}
