import type { Db } from "@paperclipai/db";
import { createHostClientHandlers } from "@paperclipai/plugin-sdk";
import { logger } from "./middleware/logger.js";
import { pluginRoutes } from "./routes/plugins.js";
import { pluginUiStaticRoutes } from "./routes/plugin-ui-static.js";
import { setPluginEventBus } from "./services/activity-log.js";
import { buildHostServices, flushPluginLogBuffer } from "./services/plugin-host-services.js";
import { createPluginDevWatcher } from "./services/plugin-dev-watcher.js";
import { createPluginEventBus } from "./services/plugin-event-bus.js";
import { createPluginHostServiceCleanup } from "./services/plugin-host-service-cleanup.js";
import { createPluginJobCoordinator } from "./services/plugin-job-coordinator.js";
import { createPluginJobScheduler } from "./services/plugin-job-scheduler.js";
import { pluginJobStore } from "./services/plugin-job-store.js";
import { DEFAULT_LOCAL_PLUGIN_DIR, pluginLoader } from "./services/plugin-loader.js";
import { pluginLifecycleManager } from "./services/plugin-lifecycle.js";
import { pluginRegistryService } from "./services/plugin-registry.js";
import { createPluginToolDispatcher } from "./services/plugin-tool-dispatcher.js";
import { createPluginWorkerManager } from "./services/plugin-worker-manager.js";

export type PluginUiMode = "none" | "static" | "vite-dev";

export type PluginStack = {
  pluginApiRouter: ReturnType<typeof pluginRoutes>;
  pluginUiRouter: ReturnType<typeof pluginUiStaticRoutes>;
  start: () => void;
  disposeOnExit: () => void;
};

/**
 * Shared plugin worker/scheduler/API/UI wiring used by the Express `createApp` entry and the Nest bootstrap.
 */
export function createPluginStack(
  db: Db,
  opts: {
    localPluginDir?: string;
    instanceId?: string;
    hostVersion?: string;
    uiMode: PluginUiMode;
  },
): PluginStack {
  const localPluginDir = opts.localPluginDir ?? DEFAULT_LOCAL_PLUGIN_DIR;
  const hostServicesDisposers = new Map<string, () => void>();
  const workerManager = createPluginWorkerManager();
  const pluginRegistry = pluginRegistryService(db);
  const eventBus = createPluginEventBus();
  setPluginEventBus(eventBus);
  const jobStore = pluginJobStore(db);
  const lifecycle = pluginLifecycleManager(db, { workerManager });
  const scheduler = createPluginJobScheduler({
    db,
    jobStore,
    workerManager,
  });
  const toolDispatcher = createPluginToolDispatcher({
    workerManager,
    lifecycleManager: lifecycle,
    db,
  });
  const jobCoordinator = createPluginJobCoordinator({
    db,
    lifecycle,
    scheduler,
    jobStore,
  });
  const hostServiceCleanup = createPluginHostServiceCleanup(lifecycle, hostServicesDisposers);
  const loader = pluginLoader(
    db,
    { localPluginDir },
    {
      workerManager,
      eventBus,
      jobScheduler: scheduler,
      jobStore,
      toolDispatcher,
      lifecycleManager: lifecycle,
      instanceInfo: {
        instanceId: opts.instanceId ?? "default",
        hostVersion: opts.hostVersion ?? "0.0.0",
      },
      buildHostHandlers: (pluginId, manifest) => {
        const notifyWorker = (method: string, params: unknown) => {
          const handle = workerManager.getWorker(pluginId);
          if (handle) handle.notify(method, params);
        };
        const services = buildHostServices(db, pluginId, manifest.id, eventBus, notifyWorker);
        hostServicesDisposers.set(pluginId, () => services.dispose());
        return createHostClientHandlers({
          pluginId,
          capabilities: manifest.capabilities,
          services,
        });
      },
    },
  );

  const pluginApiRouter = pluginRoutes(
    db,
    loader,
    { scheduler, jobStore },
    { workerManager },
    { toolDispatcher },
    { workerManager },
  );

  const pluginUiRouter = pluginUiStaticRoutes(db, {
    localPluginDir,
  });

  const devWatcher =
    opts.uiMode === "vite-dev"
      ? createPluginDevWatcher(
          lifecycle,
          async (pluginId) => (await pluginRegistry.getById(pluginId))?.packagePath ?? null,
        )
      : null;

  function start() {
    jobCoordinator.start();
    scheduler.start();
    void toolDispatcher.initialize().catch((err) => {
      logger.error({ err }, "Failed to initialize plugin tool dispatcher");
    });
    void loader
      .loadAll()
      .then((result) => {
        if (!result) return;
        for (const loaded of result.results) {
          if (devWatcher && loaded.success && loaded.plugin.packagePath) {
            devWatcher.watch(loaded.plugin.id, loaded.plugin.packagePath);
          }
        }
      })
      .catch((err) => {
        logger.error({ err }, "Failed to load ready plugins on startup");
      });
  }

  function disposeOnExit() {
    process.once("exit", () => {
      devWatcher?.close();
      hostServiceCleanup.disposeAll();
      hostServiceCleanup.teardown();
    });
    process.once("beforeExit", () => {
      void flushPluginLogBuffer();
    });
  }

  return { pluginApiRouter, pluginUiRouter, start, disposeOnExit };
}
