import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { ensurePostgresDatabase, getPostgresDataDirectory } from "@paperclipai/db";
import detectPort from "detect-port";
import type { Config } from "../config.js";
import { logger } from "../middleware/logger.js";
import { ensureMigrations, type MigrationSummary } from "./ensure-migrations.js";

export type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

export type EmbeddedPostgresStartResult = {
  connectionString: string;
  migrationSummary: MigrationSummary;
  embeddedPostgres: EmbeddedPostgresInstance | null;
  embeddedPostgresStartedByThisProcess: boolean;
  startupDbInfo: { mode: "embedded-postgres"; dataDir: string; port: number };
};

/**
 * Starts embedded PostgreSQL (when no DATABASE_URL), ensures DB + migrations — same behavior as the Express entry.
 */
export async function startEmbeddedPostgresDatabase(config: Config): Promise<EmbeddedPostgresStartResult> {
  const moduleName = "embedded-postgres";
  let EmbeddedPostgres: EmbeddedPostgresCtor;
  try {
    const mod = await import(moduleName);
    EmbeddedPostgres = mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL mode requires dependency `embedded-postgres`. Reinstall dependencies (without omitting required packages), or set DATABASE_URL for external Postgres.",
    );
  }

  let embeddedPostgres: EmbeddedPostgresInstance | null = null;
  let embeddedPostgresStartedByThisProcess = false;

  const dataDir = resolve(config.embeddedPostgresDataDir);
  const configuredPort = config.embeddedPostgresPort;
  let port = configuredPort;
  const embeddedPostgresLogBuffer: string[] = [];
  const EMBEDDED_POSTGRES_LOG_BUFFER_LIMIT = 120;
  const verboseEmbeddedPostgresLogs = process.env.PAPERCLIP_EMBEDDED_POSTGRES_VERBOSE === "true";
  const appendEmbeddedPostgresLog = (message: unknown) => {
    const text = typeof message === "string" ? message : message instanceof Error ? message.message : String(message ?? "");
    for (const lineRaw of text.split(/\r?\n/)) {
      const line = lineRaw.trim();
      if (!line) continue;
      embeddedPostgresLogBuffer.push(line);
      if (embeddedPostgresLogBuffer.length > EMBEDDED_POSTGRES_LOG_BUFFER_LIMIT) {
        embeddedPostgresLogBuffer.splice(0, embeddedPostgresLogBuffer.length - EMBEDDED_POSTGRES_LOG_BUFFER_LIMIT);
      }
      if (verboseEmbeddedPostgresLogs) {
        logger.info({ embeddedPostgresLog: line }, "embedded-postgres");
      }
    }
  };
  const logEmbeddedPostgresFailure = (phase: "initialise" | "start", err: unknown) => {
    if (embeddedPostgresLogBuffer.length > 0) {
      logger.error(
        {
          phase,
          recentLogs: embeddedPostgresLogBuffer,
          err,
        },
        "Embedded PostgreSQL failed; showing buffered startup logs",
      );
    }
  };

  if (config.databaseMode === "postgres") {
    logger.warn("Database mode is postgres but no connection string was set; falling back to embedded PostgreSQL");
  }

  const clusterVersionFile = resolve(dataDir, "PG_VERSION");
  const clusterAlreadyInitialized = existsSync(clusterVersionFile);
  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
  const isPidRunning = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  const getRunningPid = (): number | null => {
    if (!existsSync(postmasterPidFile)) return null;
    try {
      const pidLine = readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim();
      const pid = Number(pidLine);
      if (!Number.isInteger(pid) || pid <= 0) return null;
      if (!isPidRunning(pid)) return null;
      return pid;
    } catch {
      return null;
    }
  };

  const runningPid = getRunningPid();
  if (runningPid) {
    logger.warn(`Embedded PostgreSQL already running; reusing existing process (pid=${runningPid}, port=${port})`);
  } else {
    const configuredAdminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${configuredPort}/postgres`;
    try {
      const actualDataDir = await getPostgresDataDirectory(configuredAdminConnectionString);
      if (
        typeof actualDataDir !== "string" ||
        resolve(actualDataDir) !== resolve(dataDir)
      ) {
        throw new Error("reachable postgres does not use the expected embedded data directory");
      }
      await ensurePostgresDatabase(configuredAdminConnectionString, "paperclip");
      logger.warn(
        `Embedded PostgreSQL appears to already be reachable without a pid file; reusing existing server on configured port ${configuredPort}`,
      );
    } catch {
      const detectedPort = await detectPort(configuredPort);
      if (detectedPort !== configuredPort) {
        logger.warn(`Embedded PostgreSQL port is in use; using next free port (requestedPort=${configuredPort}, selectedPort=${detectedPort})`);
      }
      port = detectedPort;
      logger.info(`Using embedded PostgreSQL because no DATABASE_URL set (dataDir=${dataDir}, port=${port})`);
      embeddedPostgres = new EmbeddedPostgres({
        databaseDir: dataDir,
        user: "paperclip",
        password: "paperclip",
        port,
        persistent: true,
        initdbFlags: ["--encoding=UTF8", "--locale=C"],
        onLog: appendEmbeddedPostgresLog,
        onError: appendEmbeddedPostgresLog,
      });

      if (!clusterAlreadyInitialized) {
        try {
          await embeddedPostgres.initialise();
        } catch (err) {
          logEmbeddedPostgresFailure("initialise", err);
          throw err;
        }
      } else {
        logger.info(`Embedded PostgreSQL cluster already exists (${clusterVersionFile}); skipping init`);
      }

      if (existsSync(postmasterPidFile)) {
        logger.warn("Removing stale embedded PostgreSQL lock file");
        rmSync(postmasterPidFile, { force: true });
      }
      try {
        await embeddedPostgres.start();
      } catch (err) {
        logEmbeddedPostgresFailure("start", err);
        throw err;
      }
      embeddedPostgresStartedByThisProcess = true;
    }
  }

  const embeddedAdminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
  const dbStatus = await ensurePostgresDatabase(embeddedAdminConnectionString, "paperclip");
  if (dbStatus === "created") {
    logger.info("Created embedded PostgreSQL database: paperclip");
  }

  const embeddedConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  const shouldAutoApplyFirstRunMigrations = !clusterAlreadyInitialized || dbStatus === "created";
  if (shouldAutoApplyFirstRunMigrations) {
    logger.info("Detected first-run embedded PostgreSQL setup; applying pending migrations automatically");
  }
  const migrationSummary = await ensureMigrations(embeddedConnectionString, "Embedded PostgreSQL", {
    autoApply: shouldAutoApplyFirstRunMigrations,
  });

  logger.info("Embedded PostgreSQL ready");

  return {
    connectionString: embeddedConnectionString,
    migrationSummary,
    embeddedPostgres,
    embeddedPostgresStartedByThisProcess,
    startupDbInfo: { mode: "embedded-postgres", dataDir, port },
  };
}
