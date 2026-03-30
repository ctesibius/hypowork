# Phase 0 — Nest vs Express: verification test plan

## Do “all Express features” work in Nest?

**Design intent:** Nest mirrors Express: same `loadConfig()`, same `@paperclipai/server` services for most behavior, same HTTP paths under `/api`, same DB. **Phase 0 parity** is tracked in [phase-0.md](phase-0.md) and enforced in CI with builds + static markers (`pnpm ci:phase0` in `hypowork/`).

**What we do *not* automatically guarantee:** byte-identical responses for every edge case, every plugin, or every authenticated-deployment path without **your** regression passes. Treat Nest as **parity-targeted**, then **verify** using this plan.

---

## Preconditions

| Item | Notes |
|------|--------|
| One backend at a time | Default API port is **3100** for both (`PORT` / config). Don’t run Express and Nest on the same port. Nest logs a **stdout banner** (`Paperclip API (Nest)`) with URLs — Nest Logger lines are separate. |
| Static route list | `pnpm api:surface` (from `hypowork/`) prints grep-based Nest vs Express path lists — spot-check only, not HTTP tests. |
| Same database | Use the same `DATABASE_URL` / embedded data dir you trust for Express so behavior is comparable. |
| Client | `pnpm dev:client` from `hypowork/`; proxies `/api` and `/_plugins` to `http://127.0.0.1:3100` by default (`PAPERCLIP_DEV_BACKEND_URL` to override). If the API is down, Vite logs `http proxy error` / `ECONNREFUSED` and the browser may show **500** on `/api/*` — start `pnpm dev:server-nest` first. Scripts invoke `vite/dist/node/cli.js` so the dev server starts even when **Console Ninja** patches `node_modules/vite/bin/vite.js` (symptom: only the Ninja welcome line, no `Local:` URL). |
| Nest backend | `pnpm dev:server-nest` from `hypowork/` (see [server-nest/README.md](../hypowork/server-nest/README.md)). |
| Mode | **local_trusted** is the fastest checklist. **authenticated** mode needs real auth setup — add extra rows for sign-in, OAuth, hostname allowlists. |

---

## Phase A — Automated / quick (≈15 min)

| # | Step | Pass criteria |
|---|------|----------------|
| A1 | `cd hypowork && pnpm run ci:phase0` | Exits 0 (server + Nest build + contract test). Optional: `pnpm api:surface` for path list diff. |
| A2 | Nest running: `curl -sS http://127.0.0.1:3100/api/health` | JSON with `"status":"ok"`, plausible `deploymentMode`. |
| A3 | Optional: `NEST_E2E=1 DATABASE_URL=... pnpm --filter @hypowork/server-nest run test:e2e` | Vitest e2e passes (needs DB). |
| A4 | LLM routes **without** `/api` prefix: `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/llms/agent-icons.txt` | `200` (with board/session as your actor middleware allows). |

---

## Phase B — API smoke (curl / HTTP client) — local_trusted

Use base URL `http://127.0.0.1:3100`. Adjust auth headers if your client uses something other than implicit local board.

| # | Area | Suggested check | Pass criteria |
|---|------|-----------------|---------------|
| B1 | Session | `GET /api/auth/get-session` | `200`, user present in local_trusted. |
| B2 | Companies | `GET /api/companies` | `200`, array (may be empty). |
| B3 | Company detail | `GET /api/companies/{id}` | `200` for a known id, `404` for bogus id. |
| B4 | Agents | `GET /api/agents` (or list route your UI uses) | `200`. |
| B5 | Projects | `GET /api/companies/{companyId}/projects` | `200`. |
| B6 | Issues | `GET /api/companies/{companyId}/issues` | `200`. |
| B7 | Goals | `GET /api/companies/{companyId}/goals` | `200`. |
| B8 | Dashboard | `GET /api/companies/{companyId}/dashboard/...` (path per your API) | `200`. |
| B9 | Activity | `GET /api/companies/{companyId}/activity` | `200`. |
| B10 | Costs | `GET /api/companies/{companyId}/costs/...` or cost summary routes you rely on | `200` / expected shape. |
| B11 | Secrets | List secrets for company (if permitted) | `200` or `403` consistent with Express. |
| B12 | Approvals | List approvals | `200`. |
| B13 | Instance settings | `GET /api/instance-settings` or equivalent | `200`. |
| B14 | Sidebar badges | `GET /api/companies/{companyId}/sidebar-badges` (if applicable) | `200`. |
| B15 | Execution workspaces | List/get workspace for a project/issue area you use | `200`. |
| B16 | Assets | Hit image/logo URL pattern you use (if any) | `200` or redirect as Express. |
| B17 | Plugins API | `GET /api/plugins/...` or plugin manifest route your install uses | Not `500` for valid install. |
| B18 | Access | `GET /api/invites/{token}` with a **test** token | `404` invalid; real token returns summary. |
| B19 | WebSocket | Connect to `ws://127.0.0.1:3100/api/companies/{companyId}/events/ws` (or browser Network tab on Nest) | Opens without immediate error (auth may close — compare Express). |

Fill `{companyId}` / ids from data you create in the UI or seed scripts.

---

## Phase C — UI exploratory (same checklist on Express, then Nest)

Run **the same flows** twice: once against **Express** (`pnpm dev:server` / default `pnpm dev` stack), once against **Nest** (`pnpm dev:server-nest` + `pnpm dev:client`). Compare: no new errors in console, same pages load, same mutations succeed.

| # | Flow | What to watch |
|---|------|----------------|
| C1 | Login / session (if authenticated) | Session persists; no redirect loops. |
| C2 | Company list → open company | Data matches. |
| C3 | Create/edit **project** | Persist + reload. |
| C4 | Create/edit **issue** | Labels, comments, attachments if you use them. |
| C5 | **Checkout** / assign issue | Matches Express. |
| C6 | **Goals** CRUD | Matches Express. |
| C7 | **Approvals** create/comment | Matches Express. |
| C8 | **Agents** list, detail, keys, wakeup | Critical paths you use. |
| C9 | **Costs / budgets** views | Numbers load; no 500. |
| C10 | **Secrets** create/rotate (non-prod secrets) | Same as Express. |
| C11 | **Activity** feed | Events appear after actions. |
| C12 | **Dashboard** widgets | Load without error. |
| C13 | **Invites** / join flow (if applicable) | End-to-end in dev. |
| C14 | **Plugin UI** iframe (`/_plugins/...`) | Loads; API calls succeed. |
| C15 | **Live updates** (WebSocket) | Events stream when you trigger an action that publishes. |
| C16 | **File uploads** (assets, issue attachments) | Upload + fetch. |

---

## Phase D — Mutation / guard behavior (high risk)

| # | Check | Pass criteria |
|---|--------|----------------|
| D1 | **POST** that changes data (e.g. create issue) as board user | `201`/`200`, row in DB. |
| D2 | Same **mutation** with **invalid** actor (if testable) | Same status as Express (`401`/`403`). |
| D3 | **boardMutationGuard** path: mutation without board | Blocked like Express. |

---

## Phase E — Deployment modes (if you use them)

| Mode | Extra verification |
|------|---------------------|
| **authenticated** | Full Better Auth: sign-up, sign-in, `get-session`, CSRF/cookies, `allowedHostnames` if private. |
| **public** + explicit auth base URL | OAuth callbacks, `auth.publicBaseUrl`. |

---

## Recording results

Use a simple table:

| Phase | ID | Express | Nest | Notes |
|-------|-----|---------|------|-------|
| B | B2 | ✓ | ✓ | |
| C | C4 | ✓ | ✗ | attach fails: … |

**Exit criteria for “verified for our use”:** Phases **A + B** green for your ids; **C** green for flows you depend on; **D** spot-checked; **E** if applicable.

---

## References

- Parity tracker: [phase-0.md](phase-0.md)
- Route / architecture notes: [phase-0-study.md](phase-0-study.md)
- Nest dev: [hypowork/server-nest/README.md](../hypowork/server-nest/README.md)
- CI: `hypowork/package.json` → `ci:phase0`, `ci:phase0-parity`
