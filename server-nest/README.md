# Hypowork Nest server (Phase 0)

NestJS mirror of the Express server for Phase 0 conversion. Runs alongside Express; same API surface and DB.

## Structure

- **ConfigModule** — Env-based config (host, port, `DATABASE_URL`, deployment mode, etc.).
- **DbModule** — Provides `Db` from `@paperclipai/db` (same `createDb` as Express).
- **HealthModule** — `GET /api/health` (same shape as Express).
- **AuthModule** — `ActorMiddleware` (sets `req.actor`), `ActorGuard` (placeholder).

## Build and run

- **Build:** `pnpm --filter @hypowork/server-nest build` (from repo root). Requires `@paperclipai/db` and `@paperclipai/shared` (workspace).
- **Run:** Set `DATABASE_URL` (e.g. same as Express). Default port 3101 (`PORT` / `PAPERCLIP_LISTEN_PORT`).  
  - With tsx (source): `pnpm --filter @hypowork/server-nest dev` (if tsx is available in the workspace).  
  - With node (built): build `@paperclipai/db` first so `require('@paperclipai/db')` resolves to `dist`; then `node dist/main.js`.

## Express parity (route params)

Nest does not have Express `router.param()`; handlers must mirror the same normalization explicitly:

- **Agents** — `resolveAgentRouteParamId` (`src/agents/resolve-agent-route-id.ts`) for `/api/agents/:id` (UUID or company-scoped shortname).
- **Issues** — `normalizeIssueIdentifier` on `IssuesController` for `/api/issues/:id` (UUID or `PAP-123`-style identifier).
- **Projects** — `normalizeProjectReference` on `ProjectsController` for `/api/projects/:id` (UUID or shortname).
- **Admin users** — `assertAdminUserIdParam` on `AccessController` for `/api/admin/users/:userId/*` (UUID only; avoids Postgres errors on bad slugs).

Business logic stays in `@paperclipai/server` services; Nest wires HTTP + DI only.

## Next (Phase 0.3+)

Port routes and services domain-by-domain (companies, agents, projects, issues, goals, approvals, secrets, costs, activity, dashboard, sidebar-badges, access, assets, LLMs). Then auth parity (Better Auth + guard), heartbeat + realtime, bootstrap/migrations, E2E.
