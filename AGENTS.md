# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Hypowork is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.

### Previous fixes (learn from past debug sessions)

- **Before debugging any issue:** read **`docs/previous-fixed/README.md`** and open any note that matches the symptom. Prefer learning from documented root causes over repeating experiments (especially avoid “wipe the DB” as a first step when data matters).
- **After you successfully fix something:** add a short note under **`docs/previous-fixed/`**, link it from **`docs/previous-fixed/README.md`**, and mention key files or env vars so search finds it.
- Cursor rule (workflow reminder): **`.cursor/rules/previous-fixed.mdc`**

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `doc/`: operational and product docs

### Related sibling codebases (narrow IDE workspace)

You may open **only** this repo (`hypowork/`) in the IDE to keep the coding environment small and avoid unrelated trees (secrets, large clones, accidental edits). Hypowork does **not** depend on these paths at build time; they are **reference / research** checkouts that live next to `hypowork/` on disk.

**Resolve paths:** let `EXPERIMENT_ROOT` be the parent directory of `hypowork/` (the folder that contains `hypowork/`). Each row is `EXPERIMENT_ROOT/<directory>`.

| Directory | Role |
| --- | --- |
| `3d-force-graph-master` | 3D force-graph reference / experiments |
| `autoresearch-master` | Autoresearch tooling / experiments |
| `codereport` | Code reporting utilities |
| `cognee-main` | Cognee (knowledge graph / ingestion patterns) |
| `marker-master` | Marker PDF → structured text pipeline reference |
| `mem0-main` | Mem0 memory SDK / patterns |
| `paperclip-master` | Legacy Paperclip stack; agent adapters and API surface related to the control plane |
| `plate-main` | Plate editor stack reference |

**Agent limitation:** tools that only see the current workspace may not read files under `EXPERIMENT_ROOT` until that folder (or a multi-root workspace) is opened. Use this table to know *where* to look; expand the workspace or use the shell when you must read those files.

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep plan docs dated and centralized.
New plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Run this full check before claiming done:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
