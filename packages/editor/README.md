# Plate engine (hypowork)

This folder is a **vendored Plate monorepo trimmed to library packages only** — no docs site, templates, or demo apps.

## Layout

- **`./<package>/`** — `@platejs/*`, `platejs`, `@plate/scripts`, etc. live as **direct children** of this folder (no extra `packages/` tier).
- **`./udecode/*`** — `@udecode/*` forks used by Plate.
- **`./tooling/`** — shared tsdown/tsconfig/patches for building packages.
- **`./tooling/test-fixtures/`** — shared test helpers (e.g. markdown kit) that used to live under `apps/www`.

## Commands

From **`hypowork/packages/editor`**:

- `pnpm g:build` — build workspace engine packages (see `package.json` filters).
- `pnpm g:typecheck` — typecheck packages.

From **`hypowork`** (parent repo), workspace entries in `pnpm-workspace.yaml` link `@platejs/*` here when you use `workspace:` overrides in `client`.

## Upstream

Track [udecode/plate](https://github.com/udecode/plate) for updates; merge or cherry-pick into this tree as needed.
