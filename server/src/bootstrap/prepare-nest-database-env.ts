import { logger } from "../middleware/logger.js";
import { loadConfig } from "../config.js";
import { startEmbeddedPostgresDatabase } from "./start-embedded-postgres.js";

/**
 * When `DATABASE_URL` is unset, starts embedded PostgreSQL and sets `process.env.DATABASE_URL`
 * so Nest's `loadConfig()` / `ConfigService` see the same connection string as the Express entry.
 * Registers SIGINT/SIGTERM to stop embedded Postgres when this process started the cluster.
 */
export async function prepareNestDatabaseEnv(): Promise<void> {
  const config = loadConfig();
  if (process.env.PAPERCLIP_SECRETS_PROVIDER === undefined) {
    process.env.PAPERCLIP_SECRETS_PROVIDER = config.secretsProvider;
  }
  if (process.env.PAPERCLIP_SECRETS_STRICT_MODE === undefined) {
    process.env.PAPERCLIP_SECRETS_STRICT_MODE = config.secretsStrictMode ? "true" : "false";
  }
  if (process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE === undefined) {
    process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = config.secretsMasterKeyFilePath;
  }
  if (config.databaseUrl) {
    return;
  }

  const result = await startEmbeddedPostgresDatabase(config);
  process.env.DATABASE_URL = result.connectionString;

  if (result.embeddedPostgres && result.embeddedPostgresStartedByThisProcess) {
    const embedded = result.embeddedPostgres;
    const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
      logger.info({ signal }, "Stopping embedded PostgreSQL");
      try {
        await embedded.stop();
      } catch (err) {
        logger.error({ err }, "Failed to stop embedded PostgreSQL cleanly");
      } finally {
        process.exit(0);
      }
    };

    process.once("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.once("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  }
}
