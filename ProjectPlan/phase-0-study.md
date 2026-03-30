# Phase 0.1 — Study notes (Express + Nest, `hypowork/`)

This document satisfies the original **§0.1 Study** checklist in [phase-0.md](phase-0.md). It is descriptive, not a second source of truth for parity status (use the **Live parity tracker** there).

---

## 1. Route map (Express → Nest)

Express mounts most HTTP APIs under `/api` via `createApp` in [`server/src/app.ts`](../hypowork/server/src/app.ts): `boardMutationGuard`, then per-domain routers. LLM reflection routes mount **without** `/api` (`llmRoutes`). Plugins use `createPluginStack` (API under `/api`, UI under `/_plugins/...`).

| Area | Express router / entry | Nest controller / module |
|------|------------------------|----------------------------|
| Health | `routes/health.ts` | `health/health.controller.ts` |
| Companies | `routes/companies.ts` | `companies/companies.controller.ts` |
| Agents | `routes/agents.ts` | `agents/agents.controller.ts` |
| Assets | `routes/assets.ts` | `assets/assets.controller.ts` |
| Projects | `routes/projects.ts` | `projects/projects.controller.ts` |
| Issues (+ checkout/wakeup helpers) | `routes/issues.ts`, `issues-checkout-wakeup.ts` | `issues/issues.controller.ts` |
| Execution workspaces | `routes/execution-workspaces.ts` | `execution-workspaces/execution-workspaces.controller.ts` |
| Goals | `routes/goals.ts` | `goals/goals.controller.ts` |
| Approvals | `routes/approvals.ts` | `approvals/approvals.controller.ts` |
| Secrets | `routes/secrets.ts` | `secrets/secrets.controller.ts` |
| Costs | `routes/costs.ts` | `costs/costs.controller.ts` |
| Activity | `routes/activity.ts` | `activity/activity.controller.ts` |
| Dashboard | `routes/dashboard.ts` | `dashboard/dashboard.controller.ts` |
| Sidebar badges | `routes/sidebar-badges.ts` | `sidebar-badges/sidebar-badges.controller.ts` |
| Instance settings | `routes/instance-settings.ts` | `instance-settings/instance-settings.controller.ts` |
| Plugins | `plugin-stack` + `routes/plugins.ts` | `main.ts` + same `createPluginStack` |
| Access (invites, joins, skills, admin) | `routes/access.ts` | `access/access.controller.ts` |
| LLMs | `routes/llms.ts` (no `/api` prefix) | `llms/llms.controller.ts` + `applyApiGlobalPrefix` excludes `/llms/*` from `/api` |
| Auth compat | inline + Better Auth `app.all("/api/auth/*")` | `auth/nest-auth-compat.controller.ts` + Better Auth middleware |

Nested or auxiliary route modules (e.g. `routes/authz.ts`, `routes/plugin-ui-static.ts`) are imported by the above or by `app.ts` as needed.

---

## 2. Services used by routes

Route handlers call factories from [`server/src/services/index.ts`](../hypowork/server/src/services/index.ts). Nest injects `Db` and imports the **same** factories from `@paperclipai/server/services/*` (see that file’s exports: `companyService`, `agentService`, `issueService`, `heartbeatService`, `approvalService`, `accessService`, etc.).

Additional non-exported helpers live next to routes (e.g. `routes/authz.js` / Nest `auth/authz.ts` for `assertCompanyAccess`).

---

## 3. Config and environment

- **Loader:** `loadConfig()` in [`server/src/config.ts`](../hypowork/server/src/config.ts).
- **Env files:** `PAPERCLIP_ENV_FILE_PATH` (see `paths.ts`) and project `.env` (see top of `config.ts`); dotenv does not override existing env by default.
- **File config:** `readConfigFile()` — YAML/TOML style paperclip config (database, secrets, storage, etc.).
- **Nest:** [`server-nest/src/config/config.service.ts`](../hypowork/server-nest/src/config/config.service.ts) wraps the same `loadConfig()`.

Important surface fields include: `deploymentMode`, `deploymentExposure`, `host`, `port`, `databaseUrl`, `heartbeatSchedulerEnabled`, `heartbeatSchedulerIntervalMs`, storage and secrets settings. See `Config` interface in `config.ts` for the full list.

---

## 4. Heartbeat → adapter execution (high level)

```mermaid
flowchart LR
  subgraph bootstrap
    E[Express index.ts OR Nest HeartbeatBootstrapService]
    T[setInterval tick]
  end
  subgraph shared
    H[heartbeatService(db)]
    TI[tickTimers]
    RQ[resumeQueuedRuns / reapOrphanedRuns]
    GA[getServerAdapter + run execution]
    DB[(heartbeat_runs, agents, issues, ...)]
    LE[publishLiveEvent / WS]
  end
  E --> T
  T --> H
  H --> TI
  H --> RQ
  TI --> GA
  GA --> DB
  GA --> LE
```

- **Express:** [`server/src/index.ts`](../hypowork/server/src/index.ts) — `setInterval` when `heartbeatSchedulerEnabled`.
- **Nest:** [`server-nest/src/heartbeat/heartbeat.service.ts`](../hypowork/server-nest/src/heartbeat/heartbeat.service.ts) — same interval and calls into `expressHeartbeatService(db)` from [`server/src/services/heartbeat.ts`](../hypowork/server/src/services/heartbeat.ts).
- **WebSocket:** [`setupLiveEventsWebSocketServer`](../hypowork/server/src/realtime/live-events-ws.ts) from Nest `main.ts` (and Express `startServer`) with session resolution from the auth bridge.

For line-level behavior (budgets, workspaces, adapters), read `heartbeat.ts` and adapter entrypoints under `server/src/adapters/`.

---

## 5. Dual-server HTTP diff (CI)

Automated **side-by-side Express vs Nest HTTP** comparison is **not** implemented. Parity is enforced by:

- `pnpm ci:phase0` (builds + `test:contract` / `phase0-route-parity.mjs` markers),
- optional `NEST_E2E=1` smoke tests with a real `DATABASE_URL`,
- manual or scripted calls when changing behavior.

---

## 6. Optional follow-ups

- Regenerate route tables from OpenAPI or a codegen script if the API surface grows.
- Add a thin HTTP contract test that hits both servers only if product needs guaranteed byte-identical responses.
