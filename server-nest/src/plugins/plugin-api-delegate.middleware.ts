import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { getPluginApiRouter } from "./plugin-api-router.registry.js";

/**
 * Forwards `/api/plugins…` to the Express plugin API router **before** Nest route matching.
 * A late `app.use("/api", …)` after `listen()` runs after Nest's router and never sees these paths,
 * which produced 404 and "Plugin extensions unavailable: Not Found" in the client.
 */
@Injectable()
export class PluginApiDelegateMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const pathOnly = (req.originalUrl ?? req.url ?? "").split("?")[0];
    const router = getPluginApiRouter();
    if (!router) return next();

    if (pathOnly !== "/api/plugins" && !pathOnly.startsWith("/api/plugins/")) {
      return next();
    }

    const prevUrl = req.url;
    const qIdx = prevUrl.indexOf("?");
    const search = qIdx >= 0 ? prevUrl.slice(qIdx) : "";
    const stripped = pathOnly.replace(/^\/api/, "") || "/";
    req.url = stripped + search;

    return router(req, res, (err?: unknown) => {
      req.url = prevUrl;
      next(err as Error | undefined);
    });
  }
}
