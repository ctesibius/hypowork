import type { NestMiddleware } from "@nestjs/common";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthBridgeService } from "./auth-bridge.service.js";

/**
 * Delegates non–get-session traffic under `/api/auth/*` to Better Auth (authenticated mode only).
 */
@Injectable()
export class BetterAuthMiddleware implements NestMiddleware {
  private readonly log = new Logger(BetterAuthMiddleware.name);

  constructor(@Inject(AuthBridgeService) private readonly authBridge: AuthBridgeService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const handler = this.authBridge.betterAuthHandler;
    if (!handler) {
      return next();
    }

    const path = req.path ?? req.url ?? "";
    const isGetSession = req.method === "GET" && (path === "/auth/get-session" || path.endsWith("/auth/get-session"));
    if (isGetSession) {
      return next();
    }

    const isAuthPath = path.startsWith("/auth/") || path === "/auth";
    if (!isAuthPath) {
      return next();
    }

    const run = handler as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void | Promise<void>;
    void Promise.resolve(run(req, res, next)).catch((err: unknown) => {
      this.log.warn({ err }, "Better Auth handler error");
      next(err as Error);
    });
  }
}
