import type { NestMiddleware } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { Db } from "@paperclipai/db";
import { actorMiddleware } from "@paperclipai/server/middleware/auth";
import { DB } from "../db/db.module.js";
import { ConfigService } from "../config/config.service.js";
import { AuthBridgeService } from "./auth-bridge.service.js";

@Injectable()
export class ActorMiddleware implements NestMiddleware {
  private readonly expressActorMw: ReturnType<typeof actorMiddleware>;

  constructor(
    @Inject(DB) db: Db,
    @Inject(ConfigService) config: ConfigService,
    @Inject(AuthBridgeService) authBridge: AuthBridgeService,
  ) {
    this.expressActorMw = actorMiddleware(db, {
      deploymentMode: config.deploymentMode,
      resolveSession:
        config.deploymentMode === "authenticated"
          ? (req) => authBridge.resolveSession?.(req) ?? Promise.resolve(null)
          : undefined,
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    return this.expressActorMw(req, res, next);
  }
}
