# `@paperclipai/server` — Shared utilities package

**Status:** This package provides shared services, utilities, and bootstrap helpers consumed by the NestJS application (`@hypowork/server-nest`). It is **not** a standalone HTTP server entry point for production use.

## Role

| Concern | Status |
|---------|--------|
| Route handlers | ❌ Not here — in Nest controllers (`server-nest/src/`) |
| HTTP entry point | ❌ Not here — `server-nest/src/main.ts` |
| Services / business logic | ✅ Exported from `src/services/` — reused by Nest |
| Bootstrap helpers | ✅ Exported from `src/bootstrap/` — reused by Nest |
| Realtime / WebSocket | ✅ Exported from `src/realtime/` — reused by Nest |
| Plugin stack | ✅ Exported from `src/plugin-stack.ts` — reused by Nest |
| Config / env | ✅ Exported from `src/config.ts` — reused by Nest |
| Adapter factories | ✅ In `src/adapters/` — reused by Nest heartbeat |
| Auth helpers | ✅ In `src/auth/` — reused by Nest middleware |
| Type definitions | ✅ In `src/types/` and `src/attachment-types.ts` |

## Architecture direction

- **One framework:** NestJS (`@hypowork/server-nest`) is the sole HTTP entry point for dev/CI/prod.
- **`server/` = library surface:** All services, config, realtime, and adapters live here. Nest imports them rather than reimplementing.
- **No new Express routes:** Do not add route handlers in this package. If a feature needs a new endpoint, add it to Nest.

## Deprecated entry points

- `src/index.ts` — previously the Express app entry. It may still export a `createApp()` that wraps an Express router. This Express layer is no longer used in production; treat it as legacy reference material.
- `src/app.ts` — Express app factory. Same as above.

## Future

Over time, this package may be renamed or restructured (e.g. `@hypowork/server-lib`) to make the "utilities, not a server" role clearer. For now, the Nest package imports from it and the role is documented here.
