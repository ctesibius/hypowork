import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import {
  MemoryConfig,
  MemoryConfigSchema,
  MemoryItem,
  Message,
  SearchFilters,
  SearchResult,
} from "../types.js";
import {
  EmbedderFactory,
  LLMFactory,
  VectorStoreFactory,
  HistoryManagerFactory,
} from "../utils/factory.js";
import {
  FactRetrievalSchema,
  getFactRetrievalMessages,
  getUpdateMemoryMessages,
  removeCodeBlocks,
} from "../prompts/index.js";
import { Embedder } from "../embeddings/base.js";
import { LLM } from "../llms/base.js";
import { VectorStore } from "../vector_stores/base.js";
import { ConfigManager } from "../config/manager.js";
import { HistoryManager } from "../storage/base.js";
import { logger } from "../utils/logger.js";

export interface AddMemoryOptions {
  userId?: string;
  agentId?: string;
  runId?: string;
  metadata?: Record<string, any>;
  filters?: SearchFilters;
  infer?: boolean;
}

export interface SearchMemoryOptions {
  userId?: string;
  agentId?: string;
  runId?: string;
  limit?: number;
  filters?: SearchFilters;
}

export interface GetAllMemoryOptions {
  userId?: string;
  agentId?: string;
  runId?: string;
  limit?: number;
}

export interface DeleteAllMemoryOptions {
  userId?: string;
  agentId?: string;
  runId?: string;
}

export class Memory {
  private config: MemoryConfig;
  private customPrompt: string | undefined;
  private embedder: Embedder;
  private vectorStore!: VectorStore;
  private llm: LLM;
  private db: HistoryManager;
  private collectionName: string | undefined;
  private apiVersion: string;
  private _initPromise: Promise<void>;
  private _initError?: Error;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = ConfigManager.mergeConfig(config);

    this.customPrompt = this.config.customPrompt;
    this.embedder = EmbedderFactory.create(
      this.config.embedder.provider,
      this.config.embedder.config,
    );
    this.llm = LLMFactory.create(
      this.config.llm.provider,
      this.config.llm.config,
    );
    if (this.config.disableHistory) {
      this.db = {
        addHistory: async () => {},
        getHistory: async () => [],
        reset: async () => {},
        close: () => {},
      };
    } else {
      this.db = HistoryManagerFactory.create(
        this.config.historyStore!.provider,
        this.config.historyStore!,
      );
    }

    this.collectionName = this.config.vectorStore.config.collectionName;
    this.apiVersion = this.config.version || "v1.0";

    this._initPromise = this._autoInitialize().catch((error) => {
      this._initError =
        error instanceof Error ? error : new Error(String(error));
      logger.error(`Memory initialization failed: ${this._initError.message}`);
    });
  }

  private async _autoInitialize(): Promise<void> {
    if (!this.config.vectorStore.config.dimension) {
      try {
        const probe = await this.embedder.embed("dimension probe");
        this.config.vectorStore.config.dimension = probe.length;
      } catch (error: any) {
        throw new Error(
          `Failed to auto-detect embedding dimension from provider '${this.config.embedder.provider}': ${error.message}. ` +
            `Please set 'dimension' in vectorStore.config or 'embeddingDims' in embedder.config explicitly.`,
        );
      }
    }

    this.vectorStore = VectorStoreFactory.create(
      this.config.vectorStore.provider,
      this.config.vectorStore.config,
    );

    await this.vectorStore.initialize();
  }

  private async _ensureInitialized(): Promise<void> {
    await this._initPromise;
    if (this._initError) {
      this._initError = undefined;
      this._initPromise = this._autoInitialize().catch((error) => {
        this._initError =
          error instanceof Error ? error : new Error(String(error));
        logger.error(`Memory re-initialization failed: ${this._initError.message}`);
      });
      await this._initPromise;
      if (this._initError) {
        throw this._initError;
      }
    }
  }

  static fromConfig(configDict: Record<string, any>): Memory {
    const config = MemoryConfigSchema.parse(configDict);
    return new Memory(config);
  }

  async add(
    messages: string | Message[],
    config: AddMemoryOptions,
  ): Promise<SearchResult> {
    await this._ensureInitialized();
    const {
      userId,
      agentId,
      runId,
      metadata = {},
      filters = {},
      infer = true,
    } = config;

    if (userId) filters.userId = metadata.userId = userId;
    if (agentId) filters.agentId = metadata.agentId = agentId;
    if (runId) filters.runId = metadata.runId = runId;

    if (!filters.userId && !filters.agentId && !filters.runId) {
      throw new Error(
        "One of the filters: userId, agentId or runId is required!",
      );
    }

    const parsedMessages = Array.isArray(messages)
      ? (messages as Message[])
      : [{ role: "user", content: messages }];

    const finalParsedMessages = parsedMessages.map((m) => ({
      ...m,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const results = await this.addToVectorStore(
      finalParsedMessages,
      metadata,
      filters,
      infer,
    );

    return { results };
  }

  private async addToVectorStore(
    messages: Message[],
    metadata: Record<string, any>,
    filters: SearchFilters,
    infer: boolean,
  ): Promise<MemoryItem[]> {
    if (!infer) {
      const returnedMemories: MemoryItem[] = [];
      for (const message of messages) {
        if (message.role === "system") {
          continue;
        }
        const memoryId = await this.createMemory(
          message.content as string,
          {},
          metadata,
        );
        returnedMemories.push({
          id: memoryId,
          memory: message.content as string,
          metadata: { event: "ADD" },
        });
      }
      return returnedMemories;
    }

    const parsedMessages = messages.map((m) => m.content).join("\n");

    const [systemPrompt, userPrompt] = this.customPrompt
      ? [
          this.customPrompt.toLowerCase().includes("json")
            ? this.customPrompt
            : `${this.customPrompt}\n\nYou MUST return a valid JSON object with a 'facts' key containing an array of strings.`,
          `Input:\n${parsedMessages}`,
        ]
      : getFactRetrievalMessages(parsedMessages);

    const response = await this.llm.generateResponse(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { type: "json_object" },
    );

    const cleanResponse = removeCodeBlocks(response as string);
    let facts: string[] = [];
    try {
      const parsed = FactRetrievalSchema.parse(JSON.parse(cleanResponse));
      facts = parsed.facts;
    } catch (e) {
      logger.error(
        "Failed to parse facts from LLM response:",
        cleanResponse,
        e,
      );
      facts = [];
    }

    const newMessageEmbeddings: Record<string, number[]> = {};
    const retrievedOldMemory: Array<{ id: string; text: string }> = [];

    for (const fact of facts) {
      const embedding = await this.embedder.embed(fact);
      newMessageEmbeddings[fact] = embedding;

      const existingMemories = await this.vectorStore.search(
        embedding,
        5,
        filters,
      );
      for (const mem of existingMemories) {
        retrievedOldMemory.push({ id: mem.id, text: mem.payload.data });
      }
    }

    const uniqueOldMemories = retrievedOldMemory.filter(
      (mem, index) =>
        retrievedOldMemory.findIndex((m) => m.id === mem.id) === index,
    );

    const tempUuidMapping: Record<string, string> = {};
    uniqueOldMemories.forEach((item, idx) => {
      tempUuidMapping[String(idx)] = item.id;
      uniqueOldMemories[idx].id = String(idx);
    });

    const updatePrompt = getUpdateMemoryMessages(uniqueOldMemories, facts);

    const updateResponse = await this.llm.generateResponse(
      [{ role: "user", content: updatePrompt }],
      { type: "json_object" },
    );

    const cleanUpdateResponse = removeCodeBlocks(updateResponse as string);
    let memoryActions: any[] = [];
    try {
      memoryActions = JSON.parse(cleanUpdateResponse).memory || [];
    } catch (e) {
      logger.error(
        "Failed to parse memory actions from LLM response:",
        cleanUpdateResponse,
        e,
      );
      memoryActions = [];
    }

    const results: MemoryItem[] = [];
    for (const action of memoryActions) {
      try {
        switch (action.event) {
          case "ADD": {
            const memoryId = await this.createMemory(
              action.text,
              newMessageEmbeddings,
              metadata,
            );
            results.push({
              id: memoryId,
              memory: action.text,
              metadata: { event: action.event },
            });
            break;
          }
          case "UPDATE": {
            const realMemoryId = tempUuidMapping[action.id];
            await this.updateMemory(
              realMemoryId,
              action.text,
              newMessageEmbeddings,
              metadata,
            );
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: {
                event: action.event,
                previousMemory: action.old_memory,
              },
            });
            break;
          }
          case "DELETE": {
            const realMemoryId = tempUuidMapping[action.id];
            await this.deleteMemory(realMemoryId);
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: { event: action.event },
            });
            break;
          }
        }
      } catch (error) {
        logger.error(`Error processing memory action: ${error}`);
      }
    }

    return results;
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    await this._ensureInitialized();
    const memory = await this.vectorStore.get(memoryId);
    if (!memory) return null;

    const filters = {
      ...(memory.payload.userId && { userId: memory.payload.userId }),
      ...(memory.payload.agentId && { agentId: memory.payload.agentId }),
      ...(memory.payload.runId && { runId: memory.payload.runId }),
    };

    const memoryItem: MemoryItem = {
      id: memory.id,
      memory: memory.payload.data,
      hash: memory.payload.hash,
      createdAt: memory.payload.createdAt,
      updatedAt: memory.payload.updatedAt,
      metadata: {},
    };

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    for (const [key, value] of Object.entries(memory.payload)) {
      if (!excludedKeys.has(key)) {
        memoryItem.metadata![key] = value;
      }
    }

    return { ...memoryItem, ...filters };
  }

  async search(
    query: string,
    config: SearchMemoryOptions,
  ): Promise<SearchResult> {
    await this._ensureInitialized();
    const { userId, agentId, runId, limit = 100, filters = {} } = config;

    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    if (!filters.userId && !filters.agentId && !filters.runId) {
      throw new Error(
        "One of the filters: userId, agentId or runId is required!",
      );
    }

    const queryEmbedding = await this.embedder.embed(query);
    const memories = await this.vectorStore.search(
      queryEmbedding,
      limit,
      filters,
    );

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    const results = memories.map((mem) => ({
      id: mem.id,
      memory: mem.payload.data,
      hash: mem.payload.hash,
      createdAt: mem.payload.createdAt,
      updatedAt: mem.payload.updatedAt,
      score: mem.score,
      metadata: Object.entries(mem.payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(mem.payload.userId && { userId: mem.payload.userId }),
      ...(mem.payload.agentId && { agentId: mem.payload.agentId }),
      ...(mem.payload.runId && { runId: mem.payload.runId }),
    }));

    return { results };
  }

  async update(memoryId: string, data: string): Promise<{ message: string }> {
    await this._ensureInitialized();
    const embedding = await this.embedder.embed(data);
    await this.updateMemory(memoryId, data, { [data]: embedding }, {});
    return { message: "Memory updated successfully!" };
  }

  async delete(memoryId: string): Promise<{ message: string }> {
    await this._ensureInitialized();
    await this.deleteMemory(memoryId);
    return { message: "Memory deleted successfully!" };
  }

  async deleteAll(
    config: DeleteAllMemoryOptions,
  ): Promise<{ message: string }> {
    await this._ensureInitialized();
    const { userId, agentId, runId } = config;

    const filters: SearchFilters = {};
    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    if (!Object.keys(filters).length) {
      throw new Error(
        "At least one filter is required to delete all memories.",
      );
    }

    const [memories] = await this.vectorStore.list(filters);
    for (const memory of memories) {
      await this.deleteMemory(memory.id);
    }

    return { message: "Memories deleted successfully!" };
  }

  async history(memoryId: string): Promise<any[]> {
    await this._ensureInitialized();
    return this.db.getHistory(memoryId);
  }

  async reset(): Promise<void> {
    await this._ensureInitialized();
    await this.db.reset();
    await this.vectorStore.deleteCol();

    this.embedder = EmbedderFactory.create(
      this.config.embedder.provider,
      this.config.embedder.config,
    );
    this.llm = LLMFactory.create(
      this.config.llm.provider,
      this.config.llm.config,
    );

    this._initError = undefined;
    this._initPromise = this._autoInitialize().catch((error) => {
      this._initError =
        error instanceof Error ? error : new Error(String(error));
      logger.error(`Memory re-initialization failed: ${this._initError.message}`);
    });
    await this._initPromise;
  }

  async getAll(config: GetAllMemoryOptions): Promise<SearchResult> {
    await this._ensureInitialized();
    const { userId, agentId, runId, limit = 100 } = config;

    const filters: SearchFilters = {};
    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    const [memories] = await this.vectorStore.list(filters, limit);

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    const results = memories.map((mem) => ({
      id: mem.id,
      memory: mem.payload.data,
      hash: mem.payload.hash,
      createdAt: mem.payload.createdAt,
      updatedAt: mem.payload.updatedAt,
      metadata: Object.entries(mem.payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(mem.payload.userId && { userId: mem.payload.userId }),
      ...(mem.payload.agentId && { agentId: mem.payload.agentId }),
      ...(mem.payload.runId && { runId: mem.payload.runId }),
    }));

    return { results };
  }

  private async createMemory(
    data: string,
    existingEmbeddings: Record<string, number[]>,
    metadata: Record<string, any>,
  ): Promise<string> {
    const memoryId = uuidv4();
    const embedding =
      existingEmbeddings[data] || (await this.embedder.embed(data));

    const memoryMetadata = {
      ...metadata,
      data,
      hash: createHash("md5").update(data).digest("hex"),
      createdAt: new Date().toISOString(),
    };

    await this.vectorStore.insert([embedding], [memoryId], [memoryMetadata]);
    await this.db.addHistory(
      memoryId,
      null,
      data,
      "ADD",
      memoryMetadata.createdAt,
    );

    return memoryId;
  }

  private async updateMemory(
    memoryId: string,
    data: string,
    existingEmbeddings: Record<string, number[]>,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const existingMemory = await this.vectorStore.get(memoryId);
    if (!existingMemory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    const prevValue = existingMemory.payload.data;
    const embedding =
      existingEmbeddings[data] || (await this.embedder.embed(data));

    const newMetadata = {
      ...metadata,
      data,
      hash: createHash("md5").update(data).digest("hex"),
      createdAt: existingMemory.payload.createdAt,
      updatedAt: new Date().toISOString(),
      ...(existingMemory.payload.userId && {
        userId: existingMemory.payload.userId,
      }),
      ...(existingMemory.payload.agentId && {
        agentId: existingMemory.payload.agentId,
      }),
      ...(existingMemory.payload.runId && {
        runId: existingMemory.payload.runId,
      }),
    };

    await this.vectorStore.update(memoryId, embedding, newMetadata);
    await this.db.addHistory(
      memoryId,
      prevValue,
      data,
      "UPDATE",
      newMetadata.createdAt,
      newMetadata.updatedAt,
    );

    return memoryId;
  }

  private async deleteMemory(memoryId: string): Promise<string> {
    const existingMemory = await this.vectorStore.get(memoryId);
    if (!existingMemory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    const prevValue = existingMemory.payload.data;
    await this.vectorStore.delete(memoryId);
    await this.db.addHistory(
      memoryId,
      prevValue,
      null,
      "DELETE",
      undefined,
      undefined,
      1,
    );

    return memoryId;
  }
}
