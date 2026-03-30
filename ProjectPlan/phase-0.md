# Phase 0 — Express → NestJS conversion (do first)

**Goal:** Convert the Paperclip server from Express to NestJS so we can scale. Execute this phase first; NestJS skills are ready to support.

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Paperclip → NestJS section, Vision Summary)

---

## Outcome

- NestJS server that preserves the current Paperclip API and behavior (same routes, same DB, same heartbeat/adapter flow).
- Same contracts for the existing UI; optional incremental cutover (run both in CI until parity).
- Foundation for scaling: DI, modules, optional queues/Redis later.

---

## Prerequisites

- Paperclip Express server codebase (`paperclip-master/server`).
- `@paperclipai/db` (Drizzle) and adapter packages unchanged; only the server is replaced.
- NestJS skills available for patterns and review.

---

## Architecture snapshot (current Express)

| Layer   | What it is |
|--------|------------|
| Entry  | `index.ts`: config, DB (embedded or Postgres), migrations, auth, storage, `createApp(db, opts)`, HTTP + WebSocket, heartbeat scheduler. |
| App    | Express: json, logger, privateHostnameGuard, actorMiddleware, auth routes, Better Auth, `/api` router + ~15 route modules. |
| Routes | `(db, opts?) => Router`; assertBoard, assertCompanyAccess, validate(schema). |
| Services | ~18 factories `serviceName(db) => { ... }`; no DI. |
| Heartbeat | `heartbeatService(db)` + getServerAdapter; process or HTTP execution; run from setInterval in index. |
| DB     | `@paperclipai/db` (Drizzle). |
| Auth   | Better Auth; actorMiddleware sets req.actor. |

---

## Execution checklist

### Live parity tracker (Express -> Nest)

This tracker is the source of truth for migration status in this workspace.
Legend:
- `[x]` complete parity for this domain/routes
- `[~]` partially ported (some endpoints or side-effects missing)
- `[ ]` not ported yet

#### Core bootstrap/runtime
- [x] Nest app skeleton, module wiring, global `/api` prefix
- [x] Shared config (`loadConfig`) + DB module
- [x] Better Auth bridge (`/api/auth/*`) + actor middleware parity
- [x] Health route parity (`/api/health`)
- [x] Heartbeat scheduler startup + interval recovery loop
- [x] Live-events WebSocket hookup from Nest bootstrap
- [x] Migrations at startup + local-trusted board principal ensure
- [~] Embedded Postgres lifecycle parity (Express supports this directly; Nest currently expects reachable DB URL)
- [x] boardMutationGuard equivalent applied uniformly on mutations (`BoardMutationMiddleware` in `hypowork/server-nest/src/app.module.ts`)

#### Route domains parity
- [x] Companies (list/stats/get/create/update/archive/delete + import/export/preview parity)
- [x] Agents (list/get/me, org/config views, config revision read+rollback, runtime state/task sessions/reset, pause/resume/terminate/delete, key CRUD, wakeup + heartbeat invoke, adapter model/test endpoints, create/hire + permissions + patch + instructions-path, scheduler/live-runs/workspace-op/issue-live-run endpoints now in Nest)
- [x] Projects (list/get/create/update/delete + workspace CRUD + shortname resolution parity)
- [x] Issues (full parity with Express `issues.ts`: enriched `GET /issues/:id`, documents, work-products, read-state, approvals link/unlink, attachments + content stream, `GET /issues/:id/comments/:commentId`, delete issue storage cleanup — `hypowork/server-nest/src/issues/issues.controller.ts`)
- [x] Goals (list/get/create/update/delete parity)
- [x] Approvals (core CRUD + comments + side-effects/wakeup parity implemented)
- [x] Secrets (list/create/rotate/update/delete parity implemented)
- [x] Costs (GET surfaces + `POST /cost-events` + `PATCH` company/agent budgets — parity with Express `costs.ts`)
- [x] Activity (core routes + `sanitizeRecord` from `@paperclipai/server/redaction` on create, matching Express)
- [x] Dashboard
- [x] Sidebar badges
- [x] Access (board claim, skills, `POST /companies/:companyId/invites`, invite summary/onboarding, invite accept, joins approve/reject, claim-api-key, members/admin access; `hypowork/scripts/phase0-route-parity.mjs` green)
- [x] Assets (upload images/logo + content streaming)
- [x] LLMs
- [x] Execution workspaces (`GET` + `PATCH` archive/cleanup flow)
- [x] Plugin UI static route (`/_plugins/:pluginId/ui/*`) — `pluginStack.pluginUiRouter` in `hypowork/server-nest/src/main.ts`
- [x] Plugins API (`/api/plugins/*`) — `PluginApiDelegateMiddleware` + `createPluginStack` router registry (same stack as Express)

#### Tests/parity verification
- [x] Nest smoke e2e scaffold (`server-nest/test`)
- [x] Static route-marker parity (`hypowork/scripts/phase0-route-parity.mjs` + `server-nest/test/phase0-parity.vitest-spec.ts`)
- [ ] CI dual-run contract comparison (Express vs Nest)

#### Execution log
- [x] Added live parity tracker to this document.
- [x] Ported Companies mutations/import/export parity to Nest (`server-nest/src/companies/companies.controller.ts`).
- [x] Ported Projects mutation + workspace CRUD + shortname resolution parity to Nest (`server-nest/src/projects/projects.controller.ts`).
- [x] Ported Goals create/update/delete parity to Nest (`server-nest/src/goals/goals.controller.ts`).
- [x] Completed Access invite accept flow parity in Nest (`POST /api/invites/:token/accept`) including bootstrap-CEO path, replay support, claim secret generation, and onboarding payload response.
- [x] Added next Agents parity block in Nest (`GET /agents/:id`, pause/resume/terminate/delete, keys CRUD, `POST /agents/:id/wakeup`).
- [x] Added agents configuration/runtime/org block in Nest (`/agents/me`, `/companies/:companyId/org`, config and config-revision endpoints, runtime-state/task-sessions/reset-session).
- [x] Added agents mutation/admin expansion in Nest (`/companies/:companyId/adapters/:type/models`, `/adapters/:type/test-environment`, create agent, update permissions, update agent, company heartbeat-runs + run detail/events/log/cancel, heartbeat invoke).
- [x] Added agents observability/live-run endpoints in Nest (`/instance/scheduler-heartbeats`, `/companies/:companyId/live-runs`, `/heartbeat-runs/:runId/workspace-operations`, `/workspace-operations/:operationId/log`, `/issues/:issueId/live-runs`, `/issues/:issueId/active-run`) and added `/agents/:id/instructions-path`.
- [x] Added `POST /companies/:companyId/agent-hires` parity flow in Nest (approval creation/linking + activity log).
- [x] Added Issues core mutation block in Nest (`labels`, `create/update/delete`, `checkout/release`, `comments`).
- [x] Parity script fixes: cost events + budgets, `POST /companies/:companyId/invites`, activity redaction import, `GET /issues/:id/heartbeat-context`, shared `createCompanyInviteRecord` in `@paperclipai/server/routes/access.ts`.
- [x] Completed remaining Issues domain parity (documents, work-products, read, approvals, attachments, single comment, enriched issue GET, delete+storage) — `@paperclipai/server` exports `./services/documents` and `./services/work-products`.
- [x] Added Documents module for MVP (`server-nest/src/documents/`): standalone company documents CRUD + revisions + issue linking endpoints. UI pages (`Documents.tsx`, `DocumentDetail.tsx`) already existed in client.

#### Phase 0 closed (2026-03-21) — Nest-only

**Nest is the sole supported runtime.** Express dual-run is no longer maintained.

| Area | Status |
|------|--------|
| CI dual-run (Express vs Nest) | **N/A** — Nest-only; use `pnpm ci:phase0` (Nest build + parity) |
| Migration checklist (0.1–0.7) | **Superseded** by live parity tracker above |

**Verification:** `pnpm ci:phase0` (Nest build + `phase0-route-parity.mjs`).

**`server/` role:** `hypowork/server/README.md` — shared utilities package consumed by Nest. Not a standalone framework.

**Next:** [mvp.md](mvp.md) → [phase-1.md](phase-1.md).

---

## Effort summary

| Block            | Effort (days) |
|------------------|----------------|
| Study            | 1–2            |
| Nest skeleton    | 1–2            |
| Port routes/svcs | 5–10           |
| Auth             | 1–2            |
| Heartbeat+realtime | 1–2          |
| Bootstrap/embed  | 0.5–1          |
| Testing+parity   | 2–3            |
| **Total**        | **~12–22**     |

---

## Done when

- Nest server serves all current Paperclip API routes with same behavior.
- Heartbeat and live events work as today.
- Existing UI works against Nest server (or both run with parity).
- NestJS skills were used for structure, guards, and modules.

**Next:** After Phase 0, build **[mvp.md](mvp.md)** on Nest (company/department, employees, board, notes/plans) as the first user-facing deliverable; then proceed to [phase-1.md](phase-1.md) (memory, chat, canvas, learner). Company-doc implementation details (scale, wikilink graph, Mem0 neighborhood) live in [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md).
