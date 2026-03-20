import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { DB } from "../db/db.module.js";
import { ConfigService } from "../config/config.service.js";

/** Mirrors Express `setInterval` heartbeat tick + startup reap/resume. */
@Injectable()
export class HeartbeatBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(HeartbeatBootstrapService.name);
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.heartbeatSchedulerEnabled) {
      return;
    }

    const heartbeat = expressHeartbeatService(this.db);

    void heartbeat
      .reapOrphanedRuns()
      .then(() => heartbeat.resumeQueuedRuns())
      .catch((err: unknown) => {
        this.log.error({ err }, "startup heartbeat recovery failed");
      });

    this.interval = setInterval(() => {
      void heartbeat
        .tickTimers(new Date())
        .then((result) => {
          if (result.enqueued > 0) {
            this.log.log({ ...result }, "heartbeat timer tick enqueued runs");
          }
        })
        .catch((err: unknown) => {
          this.log.error({ err }, "heartbeat timer tick failed");
        });

      void heartbeat
        .reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })
        .then(() => heartbeat.resumeQueuedRuns())
        .catch((err: unknown) => {
          this.log.error({ err }, "periodic heartbeat recovery failed");
        });
    }, this.config.heartbeatSchedulerIntervalMs);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
