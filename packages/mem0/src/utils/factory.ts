import { OpenAIEmbedder } from "../embeddings/openai.js";
import { OllamaEmbedder } from "../embeddings/ollama.js";
import { GoogleEmbedder } from "../embeddings/google.js";
import { OpenAILLM } from "../llms/openai.js";
import { AnthropicLLM } from "../llms/anthropic.js";
import { OllamaLLM } from "../llms/ollama.js";
import { GoogleLLM } from "../llms/google.js";
import { MemoryVectorStore } from "../vector_stores/memory.js";
import { PgVectorStore } from "../vector_stores/pgvector.js";
import { SQLiteManager } from "../storage/sqlite.js";
import { PostgresHistoryManager } from "../storage/postgres.js";
import {
  EmbeddingConfig,
  HistoryStoreConfig,
  LLMConfig,
  VectorStoreConfig,
} from "../types.js";
import { Embedder } from "../embeddings/base.js";
import { LLM } from "../llms/base.js";
import { VectorStore } from "../vector_stores/base.js";
import { HistoryManager } from "../storage/base.js";

export class EmbedderFactory {
  static create(provider: string, config: EmbeddingConfig): Embedder {
    switch (provider.toLowerCase()) {
      case "openai":
        return new OpenAIEmbedder(config);
      case "ollama":
        return new OllamaEmbedder(config);
      case "google":
      case "gemini":
        return new GoogleEmbedder(config);
      default:
        throw new Error(`Unsupported embedder provider: ${provider}`);
    }
  }
}

export class LLMFactory {
  static create(provider: string, config: LLMConfig): LLM {
    switch (provider.toLowerCase()) {
      case "openai":
        return new OpenAILLM(config);
      case "anthropic":
        return new AnthropicLLM(config);
      case "ollama":
        return new OllamaLLM(config);
      case "google":
      case "gemini":
        return new GoogleLLM(config);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}

export class VectorStoreFactory {
  static create(provider: string, config: VectorStoreConfig): VectorStore {
    switch (provider.toLowerCase()) {
      case "memory":
        return new MemoryVectorStore(config);
      case "pgvector":
        return new PgVectorStore(config);
      default:
        throw new Error(`Unsupported vector store provider: ${provider}`);
    }
  }
}

export class HistoryManagerFactory {
  static create(provider: string, config: HistoryStoreConfig): HistoryManager {
    switch (provider.toLowerCase()) {
      case "sqlite":
        return new SQLiteManager(config.config.historyDbPath || ":memory:");
      case "postgres":
        return new PostgresHistoryManager(config.config as any);
      default:
        return new SQLiteManager(":memory:");
    }
  }
}
