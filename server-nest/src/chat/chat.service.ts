import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { MemoryService } from "../memory/memory.service.js";
import { VaultService } from "../vault/vault.service.js";
import { DB } from "../db/db.module.js";
import { buildDocumentNeighborhoodRagLinks } from "./document-neighborhood-rag.util.js";
import {
  ChatThread,
  ChatMessage,
  ChatResponse,
  CreateThreadDto,
  SendMessageDto,
  RAGContext,
  Citation,
  CitationSourceType,
} from "./chat.types.js";

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

    const thread: ChatThread = {
      id,
      companyId,
      title: dto.title,
      type: dto.type ?? "general",
      scope: dto.scope,
      agentId: dto.agentId,
      documentId: dto.documentId,
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
  ): Promise<ChatThread[]> {
    const threads = this.threads.get(companyId) ?? [];
    return threads
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
    userMessage: string,
    ragContext: RAGContext,
    thread: ChatThread,
    nodeSummary: string,
  ): Promise<string> {
    let contextStr = "";

    if (nodeSummary) {
      contextStr += `## Canvas node context\n${nodeSummary}\n\n`;
    }
    if (ragContext.memories.length > 0) {
      contextStr += "## Relevant memories\n";
      for (const m of ragContext.memories) {
        contextStr += `- ${m.content}\n`;
      }
      contextStr += "\n";
    }
    if (ragContext.vaultEntries.length > 0) {
      contextStr += "## Relevant vault entries\n";
      for (const v of ragContext.vaultEntries) {
        contextStr += `- [${v.title}] (${v.type}): ${v.content}\n`;
      }
      contextStr += "\n";
    }
    if (ragContext.documentLinks.length > 0) {
      contextStr += "## Linked documents\n";
      for (const d of ragContext.documentLinks) {
        contextStr += `- ${d.title}: ${d.excerpt}\n`;
      }
      contextStr += "\n";
    }

    const prompt = `${this.SYSTEM_PROMPT}

${contextStr ? `Context from company knowledge base:\n${contextStr}` : ""}

User question: ${userMessage}

Please provide a helpful, accurate response based on the context above.`;

    let response = "Based on the canvas node and company knowledge base:\n\n";
    if (nodeSummary) {
      response += `**Canvas context:** ${nodeSummary.split("\n").slice(0, 3).join(" ")}\n\n`;
    }
    if (ragContext.memories.length > 0) {
      response += "**From memory:** " + ragContext.memories[0].content + "\n\n";
    }
    if (ragContext.vaultEntries.length > 0) {
      response += "**From vault:** " + ragContext.vaultEntries[0].content + "\n\n";
    }
    if (ragContext.documentLinks.length > 0) {
      response += "**From documents:** " + ragContext.documentLinks[0].excerpt + "\n\n";
    }
    if (ragContext.memories.length === 0 && ragContext.vaultEntries.length === 0 && ragContext.documentLinks.length === 0 && !nodeSummary) {
      response = "I couldn't find any relevant information. Try rephrasing or asking about a specific document.";
    }

    return response;
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
    if (thread.documentId) {
      try {
        documentLinks = await buildDocumentNeighborhoodRagLinks(
          this.db,
          companyId,
          thread.documentId,
          28,
        );
      } catch (e) {
        this.logger.warn(`Document neighborhood RAG failed: ${(e as Error).message}`);
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

  /**
   * Generate a response using the RAG context
   * In production, this would call an LLM API
   */
  private async generateResponse(
    userMessage: string,
    ragContext: RAGContext,
    thread: ChatThread,
  ): Promise<string> {
    // Build context string
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

    // Build prompt with context
    const prompt = `${this.SYSTEM_PROMPT}

${contextStr ? `Context from company knowledge base:\n${contextStr}` : ""}

User question: ${userMessage}

Please provide a helpful, accurate response based on the context above.`;

    // TODO: Actually call LLM API here
    // For now, return a placeholder that indicates RAG worked
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

    if (ragContext.memories.length === 0 && ragContext.vaultEntries.length === 0 && ragContext.documentLinks.length === 0) {
      response = "I couldn't find any relevant information in the company knowledge base to answer your question. Please try rephrasing or ask about a different topic.";
    }

    return response;
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
