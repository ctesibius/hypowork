# Phase 0 — Express server study (hypowork)

Reference for Express → NestJS conversion. Source: `server/` (Express).

---

## Routes (API surface)

All under `/api` (except `/api/auth/*` which is Better Auth). `boardMutationGuard()` applied to all API routes below.

| Mount path | Route module | Service(s) used |
|------------|--------------|-----------------|
| (none) | `llmRoutes` | — (standalone) |
| `/health` | health | — (db + opts only) |
| `/companies` | companies | companyService |
| (agents at root) | agents | agentService |
| (assets) | assets | assetService, storageService |
| (projects) | projects | projectService |
| (issues) | issues | issueService, storageService |
| (execution-workspaces) | execution-workspaces | executionWorkspaceService |
| (goals) | goals | goalService |
| (approvals) | approvals | approvalService |
| (secrets) | secrets | secretService |
| (costs) | costs | costService |
| (activity) | activity | activityService |
| (dashboard) | dashboard | dashboardService |
| (sidebar-badges) | sidebar-badges | sidebarBadgeService |
| (instance-settings) | instance-settings | instanceSettingsService |
| (plugins) | plugins | pluginLoader, scheduler, jobStore, workerManager, toolDispatcher |
| (access) | access | accessService |

Additional routes: `plugin-ui-static`, `pluginRoutes`, `executionWorkspaceRoutes`, `issues-checkout-wakeup` (if present in app).  
Auth: `GET /api/auth/get-session`, `app.all("/api/auth/*authPath", betterAuthHandler)`.

---

## Services (from `server/src/services/index.ts`)

| Service | Used by routes |
|---------|----------------|
| companyService | companies |
| agentService | agents |
| assetService | assets |
| documentService | (internal) |
| projectService | projects |
| issueService | issues |
| issueApprovalService | (issues/approvals) |
| goalService | goals |
| activityService | activity |
| approvalService | approvals |
| budgetService | (internal) |
| secretService | secrets |
| costService | costs |
| financeService | (internal) |
| heartbeatService | index.ts (setInterval) |
| dashboardService | dashboard |
| sidebarBadgeService | sidebar-badges |
| accessService | access |
| instanceSettingsService | instance-settings |
| companyPortabilityService | (internal) |
| executionWorkspaceService | execution-workspaces |
| workspaceOperationService | (internal) |
| workProductService | (internal) |
| activity-log, hire-hook, live-events | cross-cutting |

Plugin stack: pluginLoader, pluginWorkerManager, pluginJobScheduler, pluginJobStore, pluginLifecycleManager, pluginJobCoordinator, pluginToolDispatcher, pluginEventBus, pluginRegistryService, etc.

---

## Config and env

- **Source:** `loadConfig()` in `config.ts`; file: `readConfigFile()` from `config-file.ts` (instance config); env: `dotenv` from `paths.ts` + CWD `.env`.
- **Key env vars:** `DATABASE_URL`, `PAPERCLIP_*` (see `config.ts` and `@paperclipai/shared` for DEPLOYMENT_MODES, STORAGE_PROVIDERS, SECRET_PROVIDERS, etc.). Instance paths: `home-paths.ts` (`PAPERCLIP_HOME`, `PAPERCLIP_INSTANCE_ID`, `PAPERCLIP_LOG_DIR`, etc.).
- **Config shape:** `Config` interface: deploymentMode, deploymentExposure, host, port, allowedHostnames, auth*, database*, storage*, secrets*, heartbeatSchedulerEnabled, heartbeatSchedulerIntervalMs, companyDeletionEnabled, etc.

---

## Heartbeat and realtime

- **Heartbeat:** `heartbeatService(db)` in `index.ts`. On startup: `reapOrphanedRuns()` then `resumeQueuedRuns()`. Then `setInterval(..., config.heartbeatSchedulerIntervalMs)` calling `heartbeat.tickTimers(new Date())` and periodically `reapOrphanedRuns` + `resumeQueuedRuns`.
- **WebSocket:** `setupLiveEventsWebSocketServer(server, db, { deploymentMode, resolveSessionFromHeaders })` in `realtime/live-events-ws.ts` — upgrades HTTP server.
- **Run logs / live events:** `run-log-store`, `live-events` (publish/subscribe); behavior unchanged in Nest.

---

## Bootstrap (index.ts)

1. Load config; set secrets env defaults.
2. Ensure DB: external Postgres (`DATABASE_URL`) or embedded Postgres (init/start, then create DB).
3. Run migrations (`ensureMigrations`).
4. If `local_trusted`: `ensureLocalTrustedBoardPrincipal(db)`.
5. If `authenticated`: init Better Auth, `resolveSession` / `resolveSessionFromHeaders`, board claim.
6. Create storage service, `createApp(db, opts)`, create HTTP server.
7. `setupLiveEventsWebSocketServer(server, db, ...)`.
8. `reconcilePersistedRuntimeServicesOnStartup(db)` (fire-and-forget).
9. If `heartbeatSchedulerEnabled`: heartbeat startup + setInterval.
10. If `databaseBackupEnabled`: setInterval for `runDatabaseBackup`.
11. `server.listen(port, host)`.

---

## Auth

- **actorMiddleware(db, { deploymentMode, resolveSession }):** Sets `req.actor` (type: `board` | `anonymous`; for board: userId, source, companyIds, isInstanceAdmin). Session from Better Auth when `authenticated`.
- **boardMutationGuard():** Ensures actor is board (and optionally company access); used on all `/api` routes.
- **Better Auth:** Mounted at `app.all("/api/auth/*authPath", betterAuthHandler)`; session resolved via `resolveSession(req)` and passed to actor middleware.

---

## Nest (`server-nest`) + Express services

- **Typecheck / build:** Nest imports Express service factories via **`@paperclipai/server` subpath exports** that resolve to **`server/dist/*.js`** + `.d.ts`. Run `pnpm --filter @paperclipai/server run build` first (wired as `predev` / `prebuild` / `pretypecheck` on `@hypowork/server-nest`).
- **Goals:** Nest uses Drizzle in `GoalsController` (no Express `goalService` import) so the Nest program stays under `server-nest/src` for `rootDir`.
- **TS config:** `tsconfig.base.json` does **not** set `rootDir` (it was resolving to `hypowork/src` for nested packages). Leaf packages set their own `rootDir: "src"` where needed.
- **Config:** `ConfigService` wraps **`loadConfig()`** from `@paperclipai/server/config` (same env + paperclip config file as Express).
- **DB bootstrap:** `DbModule` runs **`applyPendingMigrations`** when `PAPERCLIP_MIGRATION_AUTO_APPLY !== "false"`, then **`ensureLocalTrustedBoardPrincipal`** in `local_trusted` (shared helper in `server/src/bootstrap/local-trusted-board.ts`). **Embedded Postgres is not started by Nest** — use `DATABASE_URL` / `database.mode=postgres` or start DB via Express dev first.
- **Auth:** **`ActorMiddleware`** delegates to Express **`actorMiddleware`** from `@paperclipai/server/middleware/auth`. **`AuthBridgeService`** initializes Better Auth in **`authenticated`** mode. **`BetterAuthMiddleware`** forwards `/api/auth/*` (except `get-session`) to the Better Auth handler. **`NestAuthCompatController`** serves `GET /api/auth/get-session` like Express.
- **Heartbeat:** **`HeartbeatBootstrapService`** mirrors Express `setInterval` tick + startup reap/resume when `heartbeatSchedulerEnabled` in config.
- **WebSocket:** After `listen()`, **`setupLiveEventsWebSocketServer`** from `@paperclipai/server/realtime/live-events-ws` attaches to the HTTP server; **`reconcilePersistedRuntimeServicesOnStartup`** runs fire-and-forget.
- **E2E:** `pnpm --filter @hypowork/server-nest run test:e2e` — set **`NEST_E2E=1`** and a reachable **`DATABASE_URL`** to run smoke tests (otherwise skipped).

---

*Next: port remaining heavy domains (issues storage parity, plugins, access, assets, approvals, execution-workspaces, LLMs), restore deferred mutations (costs/secrets/activity), optional `boardMutationGuard` parity, embedded-Postgres in Nest bootstrap.*
