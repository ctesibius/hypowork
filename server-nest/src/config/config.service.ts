import { Injectable } from "@nestjs/common";
import { loadConfig, type Config } from "@paperclipai/server/config";
import type { MemoryConfig } from "@hypowork/mem0";

export type { Config };

/**
 * Wraps Express `loadConfig()` so Nest uses the same env + paperclip config file as `server/`.
 */
@Injectable()
export class ConfigService {
  readonly loaded: Config;

  constructor() {
    this.loaded = loadConfig();
  }

  get deploymentMode() {
    return this.loaded.deploymentMode;
  }
  get deploymentExposure() {
    return this.loaded.deploymentExposure;
  }
  get host() {
    return this.loaded.host;
  }
  get port() {
    return this.loaded.port;
  }
  get allowedHostnames() {
    return this.loaded.allowedHostnames;
  }
  get heartbeatSchedulerEnabled() {
    return this.loaded.heartbeatSchedulerEnabled;
  }
  get heartbeatSchedulerIntervalMs() {
    return this.loaded.heartbeatSchedulerIntervalMs;
  }
  get companyDeletionEnabled() {
    return this.loaded.companyDeletionEnabled;
  }

  /** Requires `DATABASE_URL` / postgres config, or embedded Postgres started in `main.ts` via `prepareNestDatabaseEnv()`. */
  get databaseUrl(): string {
    const url = this.loaded.databaseUrl;
    if (!url) {
      throw new Error(
        "Nest server requires an explicit Postgres URL: set `database.mode=postgres` and connection string in paperclip config, or set DATABASE_URL. " +
          "Embedded Postgres is only started by the Express `server` entry today.",
      );
    }
    return url;
  }

  /**
   * Memory engine configuration (Mem0-style).
   * Reads from environment variables:
   * - MEMORY_LLM_PROVIDER: openai | anthropic | ollama | google (default: openai)
   * - MEMORY_LLM_API_KEY: API key for the LLM
   * - MEMORY_LLM_MODEL: model name (e.g., gpt-4o-mini, claude-sonnet-4-20250514)
   * - MEMORY_EMBEDDER_PROVIDER: openai | ollama | google (default: openai)
   * - MEMORY_EMBEDDER_API_KEY: API key for embeddings
   * - MEMORY_EMBEDDER_MODEL: embedding model (e.g., text-embedding-3-small, nomic-embed-text)
   * - MEMORY_VECTOR_STORE: memory | qdrant | redis | supabase (default: memory)
   */
  get memoryConfig(): MemoryConfig {
    const llmProvider = process.env.MEMORY_LLM_PROVIDER || "openai";
    const embedderProvider = process.env.MEMORY_EMBEDDER_PROVIDER || "openai";

    return {
      version: "v1.1",
      disableHistory: false,
      embedder: {
        provider: embedderProvider,
        config: {
          apiKey: process.env.MEMORY_EMBEDDER_API_KEY || process.env.OPENAI_API_KEY || "",
          model: process.env.MEMORY_EMBEDDER_MODEL || "text-embedding-3-small",
          embeddingDims: parseInt(process.env.MEMORY_EMBEDDING_DIMS || "1536", 10),
        },
      },
      vectorStore: {
        provider: process.env.MEMORY_VECTOR_STORE || "memory",
        config: {
          collectionName: "hypowork_memories",
          dimension: parseInt(process.env.MEMORY_EMBEDDING_DIMS || "1536", 10),
          dbPath: process.env.MEMORY_DB_PATH || undefined,
        },
      },
      llm: {
        provider: llmProvider,
        config: {
          apiKey: process.env.MEMORY_LLM_API_KEY || process.env.OPENAI_API_KEY || "",
          model: process.env.MEMORY_LLM_MODEL || (llmProvider === "openai" ? "gpt-4o-mini" : undefined),
        },
      },
      historyStore: {
        provider: "sqlite",
        config: {
          historyDbPath: process.env.MEMORY_HISTORY_DB_PATH || ".hypowork/mem0/history.db",
        },
      },
      enableGraph: false,
    };
  }
}
