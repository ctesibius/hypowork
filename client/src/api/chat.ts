/**
 * Chat API client - Phase 1.6 chat with RAG + citations
 */

import { api } from "./client";

/** Per-thread RAG anchors (MVP: documents only). */
export type ThreadContextRef = { type: "document"; id: string };

export interface ChatThread {
  id: string;
  companyId: string;
  title: string;
  type: string;
  scope?: string;
  agentId?: string;
  documentId?: string;
  /** Software Factory / board project scope */
  projectId?: string;
  contextRefs?: ThreadContextRef[];
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  contextUsed?: string[];
  model?: string;
  promptVersionId?: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Citation {
  sourceType: "memory" | "vault" | "document" | "canvas";
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
  score?: number;
}

export interface Attachment {
  id: string;
  type: string;
  name: string;
  url: string;
}

export interface CreateThreadRequest {
  title: string;
  type?: "general" | "document" | "agent" | "search";
  scope?: "company" | "document" | "agent";
  agentId?: string;
  documentId?: string;
  projectId?: string;
  contextRefs?: ThreadContextRef[];
}

export type PatchThreadRequest = {
  title?: string;
  type?: CreateThreadRequest["type"];
  scope?: CreateThreadRequest["scope"];
  documentId?: string | null;
  contextRefs?: ThreadContextRef[];
};

export interface SendMessageRequest {
  content: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  threadId: string;
  message: ChatMessage;
  suggestions?: string[];
}

/** Nest: `@Controller("companies/:companyId/chat")` under global `/api` */
function chatRoot(companyId: string) {
  return `/companies/${companyId}/chat`;
}

export type CanvasNodeContextForChat = {
  selectedNodeType: string;
  selectedNodeData: Record<string, unknown>;
  neighborNodeTypes: string[];
  neighborNodeData: Record<string, unknown>[];
  connectedDocIds: string[];
};

class ChatApi {
  async listThreads(
    companyId: string,
    opts?: { projectId?: string; documentId?: string },
  ): Promise<ChatThread[]> {
    const q = new URLSearchParams();
    if (opts?.projectId) q.set("projectId", opts.projectId);
    if (opts?.documentId) q.set("documentId", opts.documentId);
    const qs = q.toString();
    return api.get<ChatThread[]>(`${chatRoot(companyId)}/threads${qs ? `?${qs}` : ""}`);
  }

  async getThread(companyId: string, threadId: string): Promise<ChatThread & { messages: ChatMessage[] }> {
    return api.get<ChatThread & { messages: ChatMessage[] }>(
      `${chatRoot(companyId)}/threads/${threadId}`,
    );
  }

  async createThread(companyId: string, dto: CreateThreadRequest): Promise<ChatThread> {
    return api.post<ChatThread>(`${chatRoot(companyId)}/threads`, dto);
  }

  async patchThread(companyId: string, threadId: string, dto: PatchThreadRequest): Promise<ChatThread | null> {
    return api.patch<ChatThread | null>(`${chatRoot(companyId)}/threads/${threadId}`, dto);
  }

  async deleteThread(companyId: string, threadId: string): Promise<void> {
    return api.delete<void>(`${chatRoot(companyId)}/threads/${threadId}`);
  }

  async sendMessage(
    companyId: string,
    threadId: string,
    dto: SendMessageRequest,
  ): Promise<ChatResponse> {
    return api.post<ChatResponse>(
      `${chatRoot(companyId)}/threads/${threadId}/messages`,
      dto,
    );
  }

  async sendMessageWithCanvasContext(
    companyId: string,
    threadId: string,
    dto: SendMessageRequest & { nodeContext?: CanvasNodeContextForChat },
  ): Promise<ChatResponse> {
    return api.post<ChatResponse>(
      `${chatRoot(companyId)}/threads/${threadId}/messages/with-context`,
      dto,
    );
  }

  async askAgent(
    companyId: string,
    agentId: string,
    query: string,
  ): Promise<{ answer: string; citations?: Citation[] }> {
    return api.post<{ answer: string; citations?: Citation[] }>(
      `${chatRoot(companyId)}/ask-agent`,
      { agentId, query },
    );
  }

  async rateMessage(
    companyId: string,
    messageId: string,
    rating: {
      thumbsUp?: boolean;
      rating?: number;
      feedbackText?: string;
      aspect?: string;
      promptVersionId?: string;
    },
  ): Promise<void> {
    return api.post<void>(`/companies/${companyId}/messages/${messageId}/rate`, rating);
  }
}

export const chatApi = new ChatApi();
