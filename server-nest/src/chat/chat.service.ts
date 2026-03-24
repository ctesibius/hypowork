import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { instanceSettingsService } from "@paperclipai/server/services/instance-settings";
import { secretService } from "@paperclipai/server/services/secrets";
import {
  documents,
  issueDocuments,
  softwareFactoryBlueprints,
  softwareFactoryRequirements,
  softwareFactoryValidationEvents,
  softwareFactoryWorkOrders,
} from "@paperclipai/db";
import { MemoryService } from "../memory/memory.service.js";
import { VaultService } from "../vault/vault.service.js";
import { DB } from "../db/db.module.js";
import { mergeDocumentNeighborhoodsForCenters } from "./merge-document-neighborhoods.util.js";
import { CHAT_MAX_CONTEXT_REFS } from "./chat-context-limits.js";
import { excerptDocumentBodyForRag } from "./document-rag-excerpt.util.js";
import {
  ChatThread,
  ChatMessage,
  ChatResponse,
  CreateThreadDto,
  PatchThreadDto,
  SendMessageDto,
  RAGContext,
  Citation,
  CitationSourceType,
  ThreadContextRef,
} from "./chat.types.js";
import { openaiCompatibleChatCompletion, type ChatCompletionMessage } from "./openai-compatible-chat.js";

function normalizeCreateContextRefs(dto: CreateThreadDto): ThreadContextRef[] {
  const out: ThreadContextRef[] = [];
  const seenDoc = new Set<string>();
  const pushDoc = (id: string | undefined) => {
    if (!id?.trim()) return;
    const x = id.trim();
    if (seenDoc.has(x)) return;
    seenDoc.add(x);
    out.push({ type: "document", id: x });
  };
  if (dto.documentId) pushDoc(dto.documentId);
  for (const r of dto.contextRefs ?? []) {
    if (r.type === "document") pushDoc(r.id);
  }
  return out.slice(0, CHAT_MAX_CONTEXT_REFS);
}

function normalizePatchContextRefs(refs: ThreadContextRef[]): ThreadContextRef[] {
  const out: ThreadContextRef[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    if (r.type !== "document" || !r.id?.trim()) continue;
    const id = r.id.trim();
    const k = `document:${id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: "document", id });
  }
  return out.slice(0, CHAT_MAX_CONTEXT_REFS);
}

function threadMatchesDocumentFilter(t: ChatThread, documentId: string): boolean {
  if (t.documentId === documentId) return true;
  return (t.contextRefs ?? []).some((r) => r.type === "document" && r.id === documentId);
}

function collectDocumentCenterIds(thread: ChatThread): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string | undefined) => {
    if (!id?.trim()) return;
    const x = id.trim();
    if (seen.has(x)) return;
    seen.add(x);
    ids.push(x);
  };
  push(thread.documentId);
  for (const r of thread.contextRefs ?? []) {
    if (r.type === "document") push(r.id);
  }
  return ids.slice(0, CHAT_MAX_CONTEXT_REFS);
}

/**
 * ChatService - Phase 1.6 chat with RAG + citations
 *
 * Features:
 * - Thread management
 * - Message persistence
 * - RAG from Vault + Mem0
 * - Citations from company documents
 * - Ask employee (agent) queries
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  // In-memory stores (persisted via DB in production)
  private threads: Map<string, ChatThread[]> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();

  // System prompt for RAG-enabled chat
  private readonly SYSTEM_PROMPT = `You are a helpful AI assistant for a company workspace.
You have access to company memory and documents through a RAG system.
When answering questions, use the provided context to provide accurate, grounded responses.
Always cite your sources using the provided citation format.
If you don't have enough context to answer a question, say so.`;

  constructor(
    private readonly memoryService: MemoryService,
    private readonly vaultService: VaultService,
    @Inject(DB) private readonly db: Db,
  ) {}

  /**
   * Create a new chat thread
   */
  async createThread(
    companyId: string,
    dto: CreateThreadDto,
    userId?: string,
  ): Promise<ChatThread> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const contextRefs = normalizeCreateContextRefs(dto);

    const thread: ChatThread = {
      id,
      companyId,
      title: dto.title,
      type: dto.type ?? "general",
      scope: dto.scope,
      agentId: dto.agentId,
      documentId: dto.documentId,
      projectId: dto.projectId,
      contextRefs,
      createdAt: now,
      updatedAt: now,
      createdByUserId: userId,
    };

    const threads = this.threads.get(companyId) ?? [];
    threads.push(thread);
    this.threads.set(companyId, threads);

    this.logger.log(`Created chat thread ${id} for company ${companyId}`);
    return thread;
  }

  /**
   * Get a thread by ID
   */
  async getThread(companyId: string, threadId: string): Promise<ChatThread | null> {
    const threads = this.threads.get(companyId) ?? [];
    return threads.find((t) => t.id === threadId) ?? null;
  }

  /**
   * List threads for a company
   */
  async listThreads(
    companyId: string,
    limit: number = 20,
    offset: number = 0,
    projectId?: string,
    documentId?: string,
  ): Promise<ChatThread[]> {
    const threads = this.threads.get(companyId) ?? [];
    let filtered = threads;
    if (projectId !== undefined && projectId.length > 0) {
      filtered = filtered.filter((t) => t.projectId === projectId);
    }
    if (documentId !== undefined && documentId.length > 0) {
      filtered = filtered.filter((t) => threadMatchesDocumentFilter(t, documentId));
    }
    return filtered
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Delete a thread
   */
  async deleteThread(companyId: string, threadId: string): Promise<boolean> {
    const threads = this.threads.get(companyId) ?? [];
    const filtered = threads.filter((t) => t.id !== threadId);

    if (filtered.length === threads.length) {
      return false;
    }

    this.threads.set(companyId, filtered);
    this.messages.delete(threadId);
    return true;
  }

  /**
   * Get messages for a thread
   */
  async getMessages(threadId: string): Promise<ChatMessage[]> {
    return this.messages.get(threadId) ?? [];
  }

  /**
   * Send a message and get a RAG-powered response
   */
  async sendMessage(
    companyId: string,
    threadId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponse> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Save user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      threadId,
      role: "user",
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
    this.addMessage(threadId, userMessage);

    // Build RAG context
    const ragContext = await this.buildRAGContext(companyId, thread, dto.content);

    // Generate response
    const responseContent = await this.generateResponse(
      dto.content,
      ragContext,
      thread,
    );

    // Create assistant message with citations
    const citations = this.extractCitations(ragContext);
    // TODO: Resolve active prompt version from PromptLearningService for this skill/agent
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      threadId,
      role: "assistant",
      content: responseContent,
      citations,
      contextUsed: [
        ...ragContext.memories.map((m) => m.id),
        ...ragContext.vaultEntries.map((v) => v.id),
      ],
      model: dto.model,
      promptVersionId: undefined, // Set by PromptLearningService.resolveActivePromptVersion()
      createdAt: new Date().toISOString(),
    };
    this.addMessage(threadId, assistantMessage);

    // Update thread
    await this.updateThread(companyId, threadId, { title: dto.content.slice(0, 50) });

    return {
      threadId,
      message: assistantMessage,
    };
  }

  /**
   * Send a message with link-scoped RAG context from a canvas node selection.
   * Enriches the RAG context with the selected node's neighbors and linked documents.
   */
  async sendMessageWithNodeContext(
    companyId: string,
    threadId: string,
    dto: SendMessageDto & { nodeContext?: import("./chat.types.js").CanvasNodeContextForChat },
  ): Promise<ChatResponse> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      threadId,
      role: "user",
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
    this.addMessage(threadId, userMessage);

    const ragContext = await this.buildRAGContext(companyId, thread, dto.content);
    const nodeContext = dto.nodeContext;

    if (nodeContext?.connectedDocIds?.length) {
      const linkedDocs = await this.fetchLinkedDocuments(companyId, nodeContext.connectedDocIds);
      ragContext.documentLinks.push(...linkedDocs);
    }

    const nodeSummary = nodeContext ? this.buildNodeSummary(nodeContext) : "";

    const responseContent = await this.generateResponseWithNodeContext(
      dto.content,
      ragContext,
      thread,
      nodeSummary,
    );

    const citations = this.extractCitations(ragContext);
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      threadId,
      role: "assistant",
      content: responseContent,
      citations,
      contextUsed: [
        ...ragContext.memories.map((m) => m.id),
        ...ragContext.vaultEntries.map((v) => v.id),
      ],
      model: dto.model,
      promptVersionId: undefined,
      createdAt: new Date().toISOString(),
    };
    this.addMessage(threadId, assistantMessage);
    await this.updateThread(companyId, threadId, { title: dto.content.slice(0, 50) });

    return { threadId, message: assistantMessage };
  }

  private buildNodeSummary(ctx: import("./chat.types.js").CanvasNodeContextForChat): string {
    const parts: string[] = [];
    parts.push(`## Selected canvas node: [${ctx.selectedNodeType}]`);
    parts.push(JSON.stringify(ctx.selectedNodeData, null, 2));
    if (ctx.neighborNodeTypes.length) {
      parts.push("\n## Connected nodes:");
      for (let i = 0; i < ctx.neighborNodeTypes.length; i++) {
        parts.push(`- [${ctx.neighborNodeTypes[i]}] ${JSON.stringify(ctx.neighborNodeData[i] ?? {})} `);
      }
    }
    if (ctx.connectedDocIds.length) {
      parts.push(`\n## Linked documents: ${ctx.connectedDocIds.join(", ")}`);
    }
    return parts.join("\n");
  }

  private async fetchLinkedDocuments(
    companyId: string,
    docIds: string[],
  ): Promise<RAGContext["documentLinks"]> {
    return docIds.map((id) => ({ id, title: "(linked document)", excerpt: "", score: 1 }));
  }

  private async generateResponseWithNodeContext(
    _userMessage: string,
    ragContext: RAGContext,
    thread: ChatThread,
    nodeSummary: string,
  ): Promise<string> {
    const baseRag = this.buildRagContextString(ragContext);
    const contextStr = nodeSummary.trim()
      ? `## Canvas node context\n${nodeSummary}\n\n${baseRag}`
      : baseRag;
    const systemContent = [
      this.SYSTEM_PROMPT,
      contextStr.trim() ? `Context from company knowledge base:\n${contextStr}` : "",
      "Respond to the user's latest message using the context when relevant.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const llm = await this.tryLlmCompletion(thread.companyId, thread.id, systemContent);
    if (llm !== null) {
      return llm;
    }
    return this.stubResponseFromRag(ragContext, nodeSummary);
  }

  private clipExcerpt(text: string | null | undefined, max: number): string {
    return (text ?? "").slice(0, max);
  }

  /** Pull recent Software Factory rows into the same shape as document RAG snippets (Phase 2). */
  private async loadSoftwareFactoryRagExcerpts(
    companyId: string,
    projectId: string,
  ): Promise<RAGContext["documentLinks"]> {
    const [reqs, bps, wos, vals] = await Promise.all([
      this.db
        .select({
          id: softwareFactoryRequirements.id,
          title: softwareFactoryRequirements.title,
          body: softwareFactoryRequirements.bodyMd,
        })
        .from(softwareFactoryRequirements)
        .where(
          and(
            eq(softwareFactoryRequirements.companyId, companyId),
            eq(softwareFactoryRequirements.projectId, projectId),
          ),
        )
        .orderBy(desc(softwareFactoryRequirements.updatedAt))
        .limit(10),
      this.db
        .select({
          id: softwareFactoryBlueprints.id,
          title: softwareFactoryBlueprints.title,
          body: softwareFactoryBlueprints.bodyMd,
        })
        .from(softwareFactoryBlueprints)
        .where(
          and(
            eq(softwareFactoryBlueprints.companyId, companyId),
            eq(softwareFactoryBlueprints.projectId, projectId),
          ),
        )
        .orderBy(desc(softwareFactoryBlueprints.updatedAt))
        .limit(8),
      this.db
        .select({
          id: softwareFactoryWorkOrders.id,
          title: softwareFactoryWorkOrders.title,
          body: softwareFactoryWorkOrders.descriptionMd,
        })
        .from(softwareFactoryWorkOrders)
        .where(
          and(
            eq(softwareFactoryWorkOrders.companyId, companyId),
            eq(softwareFactoryWorkOrders.projectId, projectId),
          ),
        )
        .orderBy(desc(softwareFactoryWorkOrders.updatedAt))
        .limit(12),
      this.db
        .select({
          id: softwareFactoryValidationEvents.id,
          source: softwareFactoryValidationEvents.source,
          summary: softwareFactoryValidationEvents.summary,
          payload: softwareFactoryValidationEvents.rawPayload,
        })
        .from(softwareFactoryValidationEvents)
        .where(
          and(
            eq(softwareFactoryValidationEvents.companyId, companyId),
            eq(softwareFactoryValidationEvents.projectId, projectId),
          ),
        )
        .orderBy(desc(softwareFactoryValidationEvents.createdAt))
        .limit(6),
    ]);

    const out: RAGContext["documentLinks"] = [];
    for (const r of reqs) {
      out.push({
        id: `sf-req-${r.id}`,
        title: `Requirement: ${r.title}`,
        excerpt: this.clipExcerpt(r.body, 520),
        score: 0.95,
      });
    }
    for (const b of bps) {
      out.push({
        id: `sf-bp-${b.id}`,
        title: `Blueprint: ${b.title}`,
        excerpt: this.clipExcerpt(b.body, 520),
        score: 0.92,
      });
    }
    for (const w of wos) {
      out.push({
        id: `sf-wo-${w.id}`,
        title: `Work order: ${w.title}`,
        excerpt: this.clipExcerpt(w.body, 400),
        score: 0.88,
      });
    }
    for (const v of vals) {
      const payloadStr =
        v.payload && typeof v.payload === "object"
          ? JSON.stringify(v.payload).slice(0, 400)
          : "";
      out.push({
        id: `sf-val-${v.id}`,
        title: `Validation: ${v.source}`,
        excerpt: this.clipExcerpt(v.summary ?? payloadStr, 480),
        score: 0.85,
      });
    }
    return out;
  }

  /** Standalone company documents tagged with `documents.project_id` (Phase 2). */
  private async loadProjectScopedCompanyDocumentRagExcerpts(
    companyId: string,
    projectId: string,
  ): Promise<RAGContext["documentLinks"]> {
    const rows = await this.db
      .select({
        id: documents.id,
        title: documents.title,
        latestBody: documents.latestBody,
        kind: documents.kind,
      })
      .from(documents)
      .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
      .where(
        and(
          eq(documents.companyId, companyId),
          eq(documents.projectId, projectId),
          isNull(issueDocuments.id),
        ),
      )
      .orderBy(desc(documents.updatedAt))
      .limit(8);

    const out: RAGContext["documentLinks"] = [];
    for (const row of rows) {
      const excerpt = excerptDocumentBodyForRag(row.latestBody, row.kind);
      const title = row.title?.trim() ? row.title : "Untitled document";
      out.push({
        id: row.id,
        title: `Project note: ${title}`,
        excerpt: excerpt.trim() ? excerpt : this.clipExcerpt(title, 240),
        score: 0.9,
      });
    }
    return out;
  }

  /**
   * Build RAG context from memory, vault, and documents
   */
  private async buildRAGContext(
    companyId: string,
    thread: ChatThread,
    query: string,
  ): Promise<RAGContext> {
    // 1. Search Mem0 memories
    const memoryResults = await this.memoryService.searchMemories({
      companyId,
      query,
      agentId: thread.agentId,
      limit: 8,
    });

    // 2. Search Vault entries
    const vaultResults = await this.vaultService.searchWithMemory(
      companyId,
      query,
      thread.agentId,
      5,
    );

    let documentLinks: RAGContext["documentLinks"] = [];
    const centerIds = collectDocumentCenterIds(thread);
    if (centerIds.length > 0) {
      try {
        documentLinks = await mergeDocumentNeighborhoodsForCenters(this.db, companyId, centerIds);
        this.logger.debug(
          `RAG document merge: centers=${centerIds.length} mergedRows=${documentLinks.length}`,
        );
      } catch (e) {
        this.logger.warn(`Document neighborhood RAG failed: ${(e as Error).message}`);
      }
    }

    if (thread.projectId) {
      try {
        const factoryLinks = await this.loadSoftwareFactoryRagExcerpts(companyId, thread.projectId);
        const projectDocLinks = await this.loadProjectScopedCompanyDocumentRagExcerpts(
          companyId,
          thread.projectId,
        );
        documentLinks = [...factoryLinks, ...projectDocLinks, ...documentLinks];
      } catch (e) {
        this.logger.warn(`Software factory RAG failed: ${(e as Error).message}`);
      }
    }

    return {
      memories: memoryResults.results.map((r) => ({
        id: r.id,
        content: r.memory,
        score: r.score ?? 0,
      })),
      vaultEntries: vaultResults.vaultEntries.map((e) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        type: e.type,
      })),
      documentLinks,
    };
  }

  private buildRagContextString(ragContext: RAGContext): string {
    let contextStr = "";
    if (ragContext.memories.length > 0) {
      contextStr += "## Relevant Memories\n";
      for (const m of ragContext.memories) {
        contextStr += `- ${m.content}\n`;
      }
      contextStr += "\n";
    }
    if (ragContext.vaultEntries.length > 0) {
      contextStr += "## Relevant Vault Entries\n";
      for (const v of ragContext.vaultEntries) {
        contextStr += `- [${v.title}] (${v.type}): ${v.content}\n`;
      }
      contextStr += "\n";
    }
    if (ragContext.documentLinks.length > 0) {
      contextStr += "## Relevant Documents\n";
      for (const d of ragContext.documentLinks) {
        contextStr += `- ${d.title}: ${d.excerpt}\n`;
      }
      contextStr += "\n";
    }
    return contextStr;
  }

  /**
   * Fallback when LLM is disabled or request fails (Phase 1.6 placeholder).
   */
  private stubResponseFromRag(ragContext: RAGContext, nodeSummary?: string): string {
    if (nodeSummary?.trim()) {
      let response = "Based on the canvas node and company knowledge base:\n\n";
      response += `**Canvas context:** ${nodeSummary.split("\n").slice(0, 3).join(" ")}\n\n`;
      if (ragContext.memories.length > 0) {
        response += "**From memory:** " + ragContext.memories[0].content + "\n\n";
      }
      if (ragContext.vaultEntries.length > 0) {
        response += "**From vault:** " + ragContext.vaultEntries[0].content + "\n\n";
      }
      if (ragContext.documentLinks.length > 0) {
        response += "**From documents:** " + ragContext.documentLinks[0].excerpt + "\n\n";
      }
      return response;
    }

    let response = "Based on the company knowledge base:\n\n";
    if (ragContext.memories.length > 0) {
      response += "**From memory:** " + ragContext.memories[0].content + "\n\n";
    }
    if (ragContext.vaultEntries.length > 0) {
      response += "**From vault:** " + ragContext.vaultEntries[0].content + "\n\n";
    }
    if (ragContext.documentLinks.length > 0) {
      response += "**From documents:** " + ragContext.documentLinks[0].excerpt + "\n\n";
    }
    if (
      ragContext.memories.length === 0 &&
      ragContext.vaultEntries.length === 0 &&
      ragContext.documentLinks.length === 0
    ) {
      return (
        "I couldn't find any relevant information in the company knowledge base to answer your question. " +
        "Configure chat LLM in Instance settings (or set CHAT_LLM_* env vars) for full replies. " +
        "You can also try rephrasing your question."
      );
    }
    return response;
  }

  private async tryLlmCompletion(
    companyId: string,
    threadId: string,
    systemContent: string,
  ): Promise<string | null> {
    const cfg = await instanceSettingsService(this.db, secretService(this.db)).getChatLlmRuntimeConfig(
      companyId,
    );
    if (!cfg.enabled || !cfg.apiKey || !cfg.model) {
      return null;
    }
    try {
      const threadMessages = await this.getMessages(threadId);
      const messages: ChatCompletionMessage[] = [
        { role: "system", content: systemContent },
        ...threadMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];
      return await openaiCompatibleChatCompletion({
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        messages,
      });
    } catch (e) {
      this.logger.warn(`Chat LLM completion failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Generate a response using RAG context and optional instance-configured LLM.
   */
  private async generateResponse(
    _userMessage: string,
    ragContext: RAGContext,
    thread: ChatThread,
  ): Promise<string> {
    const contextStr = this.buildRagContextString(ragContext);
    const systemContent = [
      this.SYSTEM_PROMPT,
      contextStr.trim() ? `Context from company knowledge base:\n${contextStr}` : "",
      "Respond to the user's latest message using the context when relevant.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const llm = await this.tryLlmCompletion(thread.companyId, thread.id, systemContent);
    if (llm !== null) {
      return llm;
    }
    return this.stubResponseFromRag(ragContext);
  }

  /**
   * Extract citations from RAG context
   */
  private extractCitations(ragContext: RAGContext): Citation[] {
    const citations: Citation[] = [];

    for (const m of ragContext.memories) {
      citations.push({
        sourceType: "memory",
        sourceId: m.id,
        sourceTitle: `Memory: ${m.content.slice(0, 30)}...`,
        excerpt: m.content,
        score: m.score,
      });
    }

    for (const v of ragContext.vaultEntries) {
      citations.push({
        sourceType: "vault",
        sourceId: v.id,
        sourceTitle: v.title,
        excerpt: v.content.slice(0, 200),
      });
    }

    for (const d of ragContext.documentLinks) {
      citations.push({
        sourceType: "document",
        sourceId: d.id,
        sourceTitle: d.title,
        excerpt: d.excerpt,
        score: d.score,
      });
    }

    return citations;
  }

  /**
   * Add a message to a thread
   */
  private addMessage(threadId: string, message: ChatMessage): void {
    const messages = this.messages.get(threadId) ?? [];
    messages.push(message);
    this.messages.set(threadId, messages);
  }

  /**
   * Update thread metadata
   */
  private async updateThread(
    companyId: string,
    threadId: string,
    updates: Partial<ChatThread>,
  ): Promise<void> {
    const threads = this.threads.get(companyId) ?? [];
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx !== -1) {
      threads[idx] = { ...threads[idx], ...updates, updatedAt: new Date().toISOString() };
      this.threads.set(companyId, threads);
    }
  }

  /**
   * Update thread metadata (context attachments, primary document, title).
   */
  async patchThread(companyId: string, threadId: string, dto: PatchThreadDto): Promise<ChatThread | null> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) return null;

    const updates: Partial<ChatThread> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.scope !== undefined) updates.scope = dto.scope;
    if (dto.documentId === null) updates.documentId = undefined;
    else if (dto.documentId !== undefined) updates.documentId = dto.documentId;
    if (dto.contextRefs !== undefined) {
      updates.contextRefs = normalizePatchContextRefs(dto.contextRefs);
    }

    await this.updateThread(companyId, threadId, updates);
    return this.getThread(companyId, threadId);
  }

  /**
   * Ask an agent (employee) about their known info
   */
  async askAgent(
    companyId: string,
    agentId: string,
    question: string,
  ): Promise<ChatResponse> {
    // Create a temporary thread scoped to the agent
    const thread = await this.createThread(companyId, {
      title: `Ask ${agentId}: ${question.slice(0, 30)}...`,
      type: "agent",
      scope: "agent",
      agentId,
    });

    return this.sendMessage(companyId, thread.id, { content: question });
  }
}
