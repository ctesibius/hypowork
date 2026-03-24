import { Global, Module } from "@nestjs/common";
import { applyPendingMigrations, createDb, type Db } from "@paperclipai/db";
import { ensureLocalTrustedBoardPrincipal } from "@paperclipai/server/bootstrap/local-trusted-board";
import { ConfigService } from "../config/config.service.js";

export const DB = Symbol("Db");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: async (config: ConfigService): Promise<Db> => {
        const url = config.databaseUrl;
        if (process.env.PAPERCLIP_MIGRATION_AUTO_APPLY !== "false") {
          if (process.env.PAPERCLIP_EMBEDDED_MIGRATIONS_APPLIED !== "true") {
            await applyPendingMigrations(url);
          }
        }
        const db = createDb(url);
        if (config.deploymentMode === "local_trusted") {
          await ensureLocalTrustedBoardPrincipal(db);
        }
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DB],
})
export class DbModule {}
