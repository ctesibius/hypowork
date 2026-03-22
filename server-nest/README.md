# Hypowork Nest server

**Primary HTTP entry point** for dev, CI, and production. Phase 0 (Express → NestJS conversion) is complete; Express dual-run is no longer maintained.

## Structure

- **ConfigModule** — Env-based config (host, port, `DATABASE_URL`, deployment mode, etc.).
- **DbModule** — Provides `Db` from `@paperclipai/db` (same `createDb` as Express).
- **HealthModule** — `GET /api/health` (same shape as Express).
- **AuthModule** — `ActorMiddleware` (sets `req.actor`), `ActorGuard` (placeholder).

## Build and run

- **Build:** `pnpm --filter @hypowork/server-nest build` (from repo root). Requires `@paperclipai/db` and `@paperclipai/shared` (workspace).
- **Run:** Set `DATABASE_URL` (e.g. same as Express). Default port 3101 (`PORT` / `PAPERCLIP_LISTEN_PORT`).  
  - Optional: `DOCUMENT_PATCH_METRICS=1` — logs one line per `PATCH .../companies/:id/documents/:docId` (companyId, documentId, persisted, bodyBytes) for autosave observability.  
  - Optional: **`DOCUMENT_REVISION_RETAIN_LAST`** — when set to a positive integer (e.g. `500`), after each **persisted** document update (company standalone + issue-attached), older `document_revisions` rows for that document are deleted so only the latest *N* by `revision_number` remain. Unset or `0` = **no pruning** (default). Cap 50 000.  
  - Optional: `DOCUMENT_REVISION_PRUNE_METRICS=1` — logs one JSON line per prune (`document_revision_prune`, `documentId`, `deleted`, `cutoffRevision`) when pruning runs.  
  - **Document graph:** `GET .../companies/:companyId/documents/:documentId/links?direction=out|in|both` (default `both`), `GET .../companies/:companyId/documents/:documentId/neighborhood?max=50` (clamped 1–100). Apply DB migration `0039_*` so `document_links` exists.  
  - **Doc-scoped context (RAG / agents):** `GET .../documents/:documentId/context-pack?maxDocuments=25&maxBodyCharsPerDocument=16000` — center note plus 1-hop linked standalone docs; each item has `role` `center` | `outgoing_link` | `incoming_link`, `bodyTruncated`, and `generatedAt` for provenance. Mem0/Vault can merge this bundle when those engines are wired.  
  - With tsx (source): `pnpm --filter @hypowork/server-nest dev` (if tsx is available in the workspace).  
  - With node (built): build `@paperclipai/db` first so `require('@paperclipai/db')` resolves to `dist`; then `node dist/main.js`.

## Express parity (route params)

Nest does not have Express `router.param()`; handlers must mirror the same normalization explicitly:

- **Agents** — `resolveAgentRouteParamId` (`src/agents/resolve-agent-route-id.ts`) for `/api/agents/:id` (UUID or company-scoped shortname).
- **Issues** — `normalizeIssueIdentifier` on `IssuesController` for `/api/issues/:id` (UUID or `PAP-123`-style identifier).
- **Projects** — `normalizeProjectReference` on `ProjectsController` for `/api/projects/:id` (UUID or shortname).
- **Admin users** — `assertAdminUserIdParam` on `AccessController` for `/api/admin/users/:userId/*` (UUID only; avoids Postgres errors on bad slugs).

Business logic stays in `@paperclipai/server` services; Nest wires HTTP + DI only.

## Next

Phase 0 complete. See [ProjectPlan/phase-0.md](../../ProjectPlan/phase-0.md) for the live parity tracker. Next: [ProjectPlan/mvp.md](../../ProjectPlan/mvp.md) (persist company canvas, org directory), then [ProjectPlan/phase-1.md](../../ProjectPlan/phase-1.md) (memory, chat, canvas, learner).
