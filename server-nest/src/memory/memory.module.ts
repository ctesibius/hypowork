import { Module } from "@nestjs/common";
import pg from "pg";
import { ConfigService } from "../config/config.service.js";
import { DbModule } from "../db/db.module.js";
import { MemoryService } from "./memory.service.js";
import { MemoryController } from "./memory.controller.js";

export const MEMORY_PG_POOL = Symbol("MEMORY_PG_POOL");
const { Pool } = pg;

@Module({
  imports: [DbModule],
  controllers: [MemoryController],
  providers: [
    {
      provide: MEMORY_PG_POOL,
      useFactory: (config: ConfigService): Pool | null => {
        const vectorProvider = config.memoryConfig.vectorStore.provider.toLowerCase();
        const historyProvider =
          config.memoryConfig.historyStore?.provider.toLowerCase() || "sqlite";
        if (vectorProvider !== "pgvector" && historyProvider !== "postgres") {
          return null;
        }
        return new Pool({ connectionString: config.databaseUrl });
      },
      inject: [ConfigService],
    },
    {
      provide: MemoryService,
      useFactory: (config: ConfigService, pool: Pool | null) =>
        new MemoryService(config, pool),
      inject: [ConfigService, MEMORY_PG_POOL],
    },
  ],
  exports: [MemoryService],
})
export class MemoryModule {}
