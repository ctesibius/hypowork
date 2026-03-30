import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { Memory, SearchResult, AddMemoryOptions } from "@hypowork/mem0";
import type { Pool } from "pg";
import {
  MemorySearchResult,
  MemorySearchResponse,
  MemoryAddResponse,
  MemoryAddResult,
  CompanyMemoryEntry,
} from "./memory.types.js";
import { ConfigService } from "../config/config.service.js";

/**
 * MemoryService - In-app memory engine for hypowork
 *
 * Integrates Mem0-style memory with:
 * - Per-agent runtime memory (fast recall, semantic search)
 * - Company-wide shared memory (durable artifacts)
 * - Vector store for semantic search
 * - LLM-powered fact extraction
 *
 * Uses @hypowork/mem0 package which provides:
 * - OpenAI/Anthropic/Ollama/Gemini embedders
 * - SQLite vector store (production: qdrant, redis, supabase)
 * - LLM-powered fact extraction and memory deduplication
 */
@Injectable()
export class MemoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryService.name);

  // Per-company Memory instances (each with own vector store scope)
  private companyMemories: Map<string, Memory> = new Map();
  // In-memory store for company metadata (used when Mem0 needs userId scoping)
  private companyMetaStore: Map<string, CompanyMemoryEntry[]> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly pgPool: Pool | null,
  ) {}

  /** Vector search/embeddings require a configured embedder key; avoid Mem0 calls that always 401. */
  private embedderConfigured(): boolean {
    const k = this.configService.memoryConfig.embedder?.config?.apiKey;
    return typeof k === "string" && k.trim().length > 0;
  }

  async onModuleInit() {
    this.logger.log("MemoryService initialized with Mem0 integration");
  }

  async onModuleDestroy() {
    if (!this.pgPool) {
      return;
    }
    await this.pgPool.end();
  }

  /**
   * Get or create a Memory instance for a company
   */
  private getMemoryInstance(companyId: string): Memory {
    let memory = this.companyMemories.get(companyId);
    if (!memory) {
      const config = this.configService.memoryConfig;
      const vectorProvider = config.vectorStore.provider.toLowerCase();
      if (vectorProvider === "pgvector") {
        if (!this.pgPool) {
          throw new Error(
            "MEMORY_VECTOR_STORE=pgvector requires a Postgres pool from DATABASE_URL",
          );
        }
        memory = new Memory({
          ...config,
          vectorStore: {
            ...config.vectorStore,
            provider: "pgvector",
            config: {
              ...config.vectorStore.config,
              pool: this.pgPool,
              companyId,
              dimension: config.vectorStore.config.dimension,
            },
          },
          historyStore: {
            provider:
              config.historyStore?.provider?.toLowerCase() === "postgres"
                ? "postgres"
                : "sqlite",
            config:
              config.historyStore?.provider?.toLowerCase() === "postgres"
                ? {
                    ...config.historyStore.config,
                    pool: this.pgPool,
                    companyId,
                  }
                : {
                    ...config.historyStore?.config,
                    historyDbPath: `.hypowork/mem0/companies/${companyId}/history.db`,
                  },
          },
        });
      } else {
        const companyDbPath = `.hypowork/mem0/companies/${companyId}/vector_store.db`;
        memory = new Memory({
          ...config,
          vectorStore: {
            ...config.vectorStore,
            config: {
              ...config.vectorStore.config,
              dbPath: companyDbPath,
            },
          },
          historyStore: {
            ...config.historyStore!,
            config: {
              ...config.historyStore!.config,
              historyDbPath: `.hypowork/mem0/companies/${companyId}/history.db`,
            },
          },
        });
      }
      this.companyMemories.set(companyId, memory);
    }
    return memory;
  }

  /**
   * Search memories for a company with optional agent/user scoping
   */
  async searchMemories(params: {
    companyId: string;
    query: string;
    agentId?: string;
    userId?: string;
    limit?: number;
    /** Case-insensitive substring filter on memory text after vector retrieval. */
    keyword?: string;
  }): Promise<MemorySearchResponse> {
    const { companyId, query, agentId, userId, limit = 10, keyword } = params;

    /** Mem0 requires at least one of userId, agentId, runId — use company scope for unscoped chat. */
    const effectiveUserId = userId ?? (agentId ? undefined : `company:${companyId}`);

    if (!this.embedderConfigured()) {
      return this.searchMemoriesInMemory(params);
    }

    try {
      const memory = this.getMemoryInstance(companyId);
      const searchResult = await memory.search(query, {
        agentId,
        userId: effectiveUserId,
        limit: keyword?.trim() ? Math.min(50, limit * 3) : limit,
        filters: {},
      });

      let results: MemorySearchResult[] = searchResult.results.map((item) => ({
        id: item.id,
        memory: item.memory,
        score: item.score,
        metadata: {
          ...item.metadata,
          agentId: item.metadata?.agentId,
          userId: item.metadata?.userId,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      if (keyword?.trim()) {
        const k = keyword.trim().toLowerCase();
        results = results.filter((r) => r.memory.toLowerCase().includes(k)).slice(0, limit);
      }

      return { results };
    } catch (error: any) {
      const msg = String(error?.message ?? error);
      if (msg.includes("401") || msg.toLowerCase().includes("api key")) {
        this.logger.warn(`Memory search skipped (embeddings unavailable): ${msg}`);
      } else {
        this.logger.error(`Search failed: ${msg}`);
      }
      return this.searchMemoriesInMemory(params);
    }
  }

  /**
   * Fallback in-memory search when Mem0 is unavailable
   */
  private async searchMemoriesInMemory(params: {
    companyId: string;
    query: string;
    agentId?: string;
    userId?: string;
    limit?: number;
    keyword?: string;
  }): Promise<MemorySearchResponse> {
    const { companyId, query, agentId, userId, limit = 10, keyword } = params;

    const memories = this.companyMetaStore.get(companyId) ?? [];
    let filtered = memories;

    if (agentId) {
      filtered = filtered.filter((m) => m.agentId === agentId);
    }
    if (userId) {
      filtered = filtered.filter((m) => m.userId === userId);
    }

    const queryLower = query.toLowerCase();
    const kw = keyword?.trim().toLowerCase();
    const results: MemorySearchResult[] = filtered
      .filter((m) => {
        const text = m.content.toLowerCase();
        if (!text.includes(queryLower)) return false;
        if (kw && !text.includes(kw)) return false;
        return true;
      })
      .slice(0, limit)
      .map((m) => ({
        id: m.id,
        memory: m.content,
        metadata: {
          category: m.category,
          tags: m.tags,
          agentId: m.agentId,
          userId: m.userId,
        },
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }));

    return { results };
  }

  /**
   * Add a memory entry
   */
  async addMemory(params: {
    companyId: string;
    content: string;
    agentId?: string;
    userId?: string;
    category?: string;
    tags?: string[];
  }): Promise<MemoryAddResponse> {
    const { companyId, content, agentId, userId, category, tags } = params;

    // Also store in metadata store for fallback
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const entry: CompanyMemoryEntry = {
      id,
      companyId,
      agentId,
      userId,
      content,
      category,
      tags,
      createdAt: now,
      updatedAt: now,
    };

    const existing = this.companyMetaStore.get(companyId) ?? [];
    existing.push(entry);
    this.companyMetaStore.set(companyId, existing);

    try {
      const memory = this.getMemoryInstance(companyId);
      const addResult = await memory.add(content, {
        agentId,
        userId,
        metadata: { category, tags },
        infer: true,
      });

      return {
        results: addResult.results.map((r) => ({
          id: r.id,
          memory: r.memory,
          event: (r.metadata?.event || "ADD") as "ADD" | "UPDATE" | "DELETE",
        })),
      };
    } catch (error: any) {
      this.logger.error(`Add memory failed: ${error.message}`);
      // Return the in-memory entry as fallback
      return {
        results: [{ id, memory: content, event: "ADD" }],
      };
    }
  }

  /**
   * Update a memory entry
   */
  async updateMemory(params: {
    companyId: string;
    memoryId: string;
    content: string;
  }): Promise<MemoryAddResponse> {
    const { companyId, memoryId, content } = params;

    try {
      const memory = this.getMemoryInstance(companyId);
      const result = await memory.update(memoryId, content);

      return {
        results: [{
          id: memoryId,
          memory: content,
          event: "UPDATE" as const,
        }],
      };
    } catch (error: any) {
      this.logger.error(`Update memory failed: ${error.message}`);
      return { results: [] };
    }
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(params: {
    companyId: string;
    memoryId: string;
  }): Promise<{ success: boolean }> {
    const { companyId, memoryId } = params;

    try {
      const memory = this.getMemoryInstance(companyId);
      await memory.delete(memoryId);

      // Also remove from metadata store
      const memories = this.companyMetaStore.get(companyId) ?? [];
      const filtered = memories.filter((m) => m.id !== memoryId);
      this.companyMetaStore.set(companyId, filtered);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Delete memory failed: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Get all memories for a company
   */
  async getAllMemories(params: {
    companyId: string;
    agentId?: string;
    userId?: string;
    limit?: number;
  }): Promise<MemorySearchResponse> {
    const { companyId, agentId, userId, limit = 100 } = params;

    try {
      const memory = this.getMemoryInstance(companyId);
      const searchResult = await memory.getAll({
        agentId,
        userId,
        limit,
      });

      const results: MemorySearchResult[] = searchResult.results.map((item) => ({
        id: item.id,
        memory: item.memory,
        score: item.score,
        metadata: {
          ...item.metadata,
          agentId: item.metadata?.agentId,
          userId: item.metadata?.userId,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      return { results };
    } catch (error: any) {
      this.logger.error(`Get all memories failed: ${error.message}`);
      // Fallback to in-memory
      let memories = this.companyMetaStore.get(companyId) ?? [];

      if (agentId) {
        memories = memories.filter((m) => m.agentId === agentId);
      }
      if (userId) {
        memories = memories.filter((m) => m.userId === userId);
      }

      const results: MemorySearchResult[] = memories
        .slice(0, limit)
        .map((m) => ({
          id: m.id,
          memory: m.content,
          metadata: {
            category: m.category,
            tags: m.tags,
            agentId: m.agentId,
            userId: m.userId,
          },
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }));

      return { results };
    }
  }

  /**
   * Add memories from agent session
   * Called by heartbeat/agent runtime after task completion
   */
  async addFromAgentSession(params: {
    companyId: string;
    agentId: string;
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
  }): Promise<MemoryAddResponse> {
    // Extract key facts from conversation using Mem0's fact extraction
    try {
      const memory = this.getMemoryInstance(params.companyId);
      const result = await memory.add(params.messages, {
        agentId: params.agentId,
        userId: undefined,
        metadata: { sessionId: params.sessionId },
        infer: true,
      });

      return {
        results: result.results.map((r) => ({
          id: r.id,
          memory: r.memory,
          event: (r.metadata?.event || "ADD") as "ADD" | "UPDATE" | "DELETE",
        })),
      };
    } catch (error: any) {
      this.logger.error(`Add from session failed: ${error.message}`);
      return { results: [] };
    }
  }

  /**
   * Get memory context for agent
   * Called when preparing wake context for agent
   */
  async getAgentContext(params: {
    companyId: string;
    agentId: string;
    query?: string;
    limit?: number;
  }): Promise<string> {
    const { companyId, agentId, query, limit = 5 } = params;

    try {
      const memory = this.getMemoryInstance(companyId);

      let memories;
      if (query) {
        const result = await memory.search(query, {
          agentId,
          limit,
        });
        memories = result.results;
      } else {
        const result = await memory.getAll({
          agentId,
          limit,
        });
        memories = result.results;
      }

      if (memories.length === 0) {
        return "No relevant memories found.";
      }

      const context = memories
        .map((m, i) => `${i + 1}. ${m.memory}`)
        .join("\n");

      return `Relevant memories:\n${context}`;
    } catch (error: any) {
      this.logger.error(`Get agent context failed: ${error.message}`);
      // Fallback to in-memory
      const memories = this.companyMetaStore.get(companyId) ?? [];
      const filtered = memories.filter((m) => m.agentId === agentId);

      if (filtered.length === 0) {
        return "No relevant memories found.";
      }

      const context = filtered
        .slice(0, limit)
        .map((m, i) => `${i + 1}. ${m.content}`)
        .join("\n");

      return `Relevant memories:\n${context}`;
    }
  }
}
