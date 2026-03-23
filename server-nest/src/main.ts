import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import compression from "compression";
import type { Db } from "@paperclipai/db";
import { prepareNestDatabaseEnv } from "@paperclipai/server/bootstrap/prepare-nest-database-env";
import { createPluginStack } from "../../server/dist/plugin-stack.js";
import { setupLiveEventsWebSocketServer } from "@paperclipai/server/realtime/live-events-ws";
import { reconcilePersistedRuntimeServicesOnStartup } from "@paperclipai/server/services/workspace-runtime";
import { AppModule } from "./app.module.js";
import { HttpErrorFilter } from "./filters/http-error.filter.js";
import { AuthBridgeService } from "./auth/auth-bridge.service.js";
import { ConfigService } from "./config/config.service.js";
import { DB } from "./db/db.module.js";
import { setPluginApiRouter } from "./plugins/plugin-api-router.registry.js";

async function bootstrap() {
  const log = new Logger("Bootstrap");
  await prepareNestDatabaseEnv();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalFilters(new HttpErrorFilter());
  app.use(compression());
  app.setGlobalPrefix("api");

  // Mount plugin UI router after `init()`; plugin API is delegated by Nest middleware + registry.
  await app.init();

  const config = app.get(ConfigService);
  const authBridge = app.get(AuthBridgeService);
  const db = app.get<Db>(DB);

  const uiMode = config.loaded.uiDevMiddleware ? "vite-dev" : config.loaded.serveUi ? "static" : "none";
  const pluginStack = createPluginStack(db, { uiMode });

  // Plugin API delegated via Nest `PluginApiDelegateMiddleware` — registry must be set before listen().
  setPluginApiRouter(pluginStack.pluginApiRouter);

  app.use(pluginStack.pluginUiRouter);
  pluginStack.disposeOnExit();

  await app.listen(config.port, config.host);

  const httpServer = app.getHttpServer();
  setupLiveEventsWebSocketServer(httpServer, db, {
    deploymentMode: config.deploymentMode,
    resolveSessionFromHeaders: authBridge.resolveSessionFromHeaders,
  });

  void reconcilePersistedRuntimeServicesOnStartup(db)
    .then((result) => {
      if (result.reconciled > 0) {
        log.warn({ reconciled: result.reconciled }, "reconciled persisted runtime services from a prior process");
      }
    })
    .catch((err: unknown) => {
      log.error({ err }, "startup reconciliation of persisted runtime services failed");
    });

  log.log(`Listening on http://${config.host}:${config.port} (api prefix /api)`);
}

void bootstrap();
