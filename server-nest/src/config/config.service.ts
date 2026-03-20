import { Injectable } from "@nestjs/common";
import { loadConfig, type Config } from "@paperclipai/server/config";

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
}
