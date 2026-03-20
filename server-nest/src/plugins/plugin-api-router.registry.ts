import type { RequestHandler } from "express";

let pluginApiRouter: RequestHandler | null = null;

/** Called from `main.ts` after `createPluginStack` — must run before `listen()`. */
export function setPluginApiRouter(router: RequestHandler): void {
  pluginApiRouter = router;
}

export function getPluginApiRouter(): RequestHandler | null {
  return pluginApiRouter;
}
