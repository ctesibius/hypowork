import { MemoryConfig, MemoryConfigSchema } from "../types.js";
import { DEFAULT_MEMORY_CONFIG } from "./defaults.js";

export class ConfigManager {
  static mergeConfig(userConfig: Partial<MemoryConfig> = {}): MemoryConfig {
    const mergedConfig = {
      version: userConfig.version || DEFAULT_MEMORY_CONFIG.version,
      embedder: {
        provider:
          userConfig.embedder?.provider ||
          DEFAULT_MEMORY_CONFIG.embedder.provider,
        config: (() => {
          const defaultConf = DEFAULT_MEMORY_CONFIG.embedder.config;
          const userConf = userConfig.embedder?.config;
          let finalModel: string | any = defaultConf.model;

          if (userConf?.model && typeof userConf.model === "object") {
            finalModel = userConf.model;
          } else if (userConf?.model && typeof userConf.model === "string") {
            finalModel = userConf.model;
          }

          return {
            apiKey:
              userConf?.apiKey !== undefined
                ? userConf.apiKey
                : defaultConf.apiKey,
            model: finalModel,
            url: userConf?.url,
            embeddingDims: userConf?.embeddingDims,
            modelProperties:
              userConf?.modelProperties !== undefined
                ? userConf.modelProperties
                : defaultConf.modelProperties,
          };
        })(),
      },
      vectorStore: {
        provider:
          userConfig.vectorStore?.provider ||
          DEFAULT_MEMORY_CONFIG.vectorStore.provider,
        config: (() => {
          const defaultConf = DEFAULT_MEMORY_CONFIG.vectorStore.config;
          const userConf = userConfig.vectorStore?.config;

          const explicitDimension =
            userConf?.dimension ||
            userConfig.embedder?.config?.embeddingDims ||
            undefined;

          if (userConf?.client && typeof userConf.client === "object") {
            return {
              client: userConf.client,
              collectionName: userConf.collectionName,
              dimension: explicitDimension,
              ...userConf,
            };
          } else {
            return {
              collectionName:
                userConf?.collectionName || defaultConf.collectionName,
              dimension: explicitDimension,
              client: undefined,
              ...userConf,
            };
          }
        })(),
      },
      llm: {
        provider:
          userConfig.llm?.provider || DEFAULT_MEMORY_CONFIG.llm.provider,
        config: (() => {
          const defaultConf = DEFAULT_MEMORY_CONFIG.llm.config;
          const userConf = userConfig.llm?.config;
          let finalModel: string | any = defaultConf.model;

          if (userConf?.model && typeof userConf.model === "object") {
            finalModel = userConf.model;
          } else if (userConf?.model && typeof userConf.model === "string") {
            finalModel = userConf.model;
          }

          return {
            baseURL: userConf?.baseURL || defaultConf.baseURL,
            apiKey:
              userConf?.apiKey !== undefined
                ? userConf.apiKey
                : defaultConf.apiKey,
            model: finalModel,
            modelProperties:
              userConf?.modelProperties !== undefined
                ? userConf.modelProperties
                : defaultConf.modelProperties,
          };
        })(),
      },
      historyDbPath:
        userConfig.historyDbPath ||
        userConfig.historyStore?.config?.historyDbPath ||
        DEFAULT_MEMORY_CONFIG.historyStore?.config?.historyDbPath,
      customPrompt: userConfig.customPrompt,
      historyStore: (() => {
        const defaultHistoryStore = DEFAULT_MEMORY_CONFIG.historyStore!;
        const historyProvider =
          userConfig.historyStore?.provider || defaultHistoryStore.provider;
        const isSqlite = historyProvider.toLowerCase() === "sqlite";

        return {
          ...defaultHistoryStore,
          ...userConfig.historyStore,
          provider: historyProvider,
          config: {
            ...(isSqlite ? defaultHistoryStore.config : {}),
            ...(isSqlite && userConfig.historyDbPath
              ? { historyDbPath: userConfig.historyDbPath }
              : {}),
            ...userConfig.historyStore?.config,
          },
        };
      })(),
      disableHistory:
        userConfig.disableHistory || DEFAULT_MEMORY_CONFIG.disableHistory,
      enableGraph: userConfig.enableGraph || DEFAULT_MEMORY_CONFIG.enableGraph,
    };

    return MemoryConfigSchema.parse(mergedConfig);
  }
}
