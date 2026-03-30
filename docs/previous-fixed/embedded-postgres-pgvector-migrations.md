# Embedded Postgres, pgvector, and migrations

## Symptoms

- Server logs: `Applying N pending migrations` with `0002_mem0_pgvector.sql` (or similar), then appears to **hang for a long time**, or startup never completes.
- Or migration fails immediately with Postgres error **`0A000`** / message like **`extension "vector" is not available`**.

## Root cause

**Embedded PostgreSQL** (the `embedded-postgres` npm-driven instance used in local dev) does **not** ship the **pgvector** extension. The extension must appear in `pg_available_extensions` before `CREATE EXTENSION vector` can succeed.

A migration that starts with unconditional:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

will **fail on embedded Postgres** before any tables are created. That can look like a “stuck” migration if errors are easy to miss or the process retries.

Fresh databases sometimes “work” when you are not hitting that code path yet; **wiping the DB** avoids the failing migration line but is **not** the right fix if you need to keep data.

## What we fixed (pattern)

Migration **`packages/db/src/migrations/0002_mem0_pgvector.sql`** was restructured:

1. **Non–pgvector DDL first**: tables that only need plain Postgres (`mem0_memory_history`, `mem0_user_state` and indexes) run for everyone, including embedded.
2. **pgvector-only DDL in a `DO` block**:
   - `IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')` then `RAISE NOTICE` and **return** (skip vector objects).
   - Otherwise `EXECUTE` for `CREATE EXTENSION` and `CREATE TABLE` / indexes using the `vector` type (including HNSW). **Use `EXECUTE`** inside PL/pgSQL for extension/table DDL where direct `CREATE EXTENSION` in a `DO` block is restricted.

Result: embedded dev completes migrations; external Postgres with pgvector still gets full Mem0 vector storage.

## Operational rules (for agents)

1. **Do not assume** `CREATE EXTENSION vector` runs on every developer machine. Gate on `pg_available_extensions` or split migrations.
2. **Do not recommend wiping the DB** as the first fix when migration fails. Prefer: read the **exact** Postgres error code/message, then adjust migration or use external Postgres with pgvector.
3. **`MEMORY_VECTOR_STORE=pgvector`** requires a real Postgres with pgvector and the `mem0_vectors` table; embedded-only setups should keep default **`memory`** (SQLite) or accept that vector tables were skipped until you point `DATABASE_URL` at Postgres with pgvector installed.
4. **Timeouts**: `packages/db/src/client.ts` sets `statement_timeout`, `lock_timeout`, and `connect_timeout` on migration utility connections so lock waits fail fast instead of hanging indefinitely. Tune with `PAPERCLIP_MIGRATION_STATEMENT_TIMEOUT` / `PAPERCLIP_MIGRATION_LOCK_TIMEOUT` if needed.

## Quick verification SQL

On the same database URL:

```sql
SELECT name, installed_version IS NOT NULL AS installed
FROM pg_available_extensions
WHERE name = 'vector';
```

- No row or not installed: expect Mem0 vector **migration skip** on embedded; use external Postgres + pgvector for production pgvector mode.

## Related docs

- [Environment variables (Memory / pgvector)](../deploy/environment-variables.md#memory-engine-mem0)

## Fix summary (historical)

| Item | Detail |
| ---- | ------ |
| Cause | `CREATE EXTENSION vector` on a server with no pgvector package (`0A000`). |
| Change | Split migration: plain tables first; conditional pgvector block with `EXECUTE`. |
| Files | `packages/db/src/migrations/0002_mem0_pgvector.sql`, `docs/deploy/environment-variables.md` |
