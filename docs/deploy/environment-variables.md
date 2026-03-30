---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that Hypowork uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `PAPERCLIP_HOME` | `~/.paperclip` | Base directory for all Hypowork data |
| `PAPERCLIP_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `PAPERCLIP_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `PAPERCLIP_SECRETS_MASTER_KEY_FILE` | `~/.paperclip/.../secrets/master.key` | Path to key file |
| `PAPERCLIP_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_AGENT_ID` | Agent's unique ID |
| `PAPERCLIP_COMPANY_ID` | Company ID |
| `PAPERCLIP_API_URL` | Hypowork API base URL |
| `PAPERCLIP_API_KEY` | Short-lived JWT for API auth |
| `PAPERCLIP_RUN_ID` | Current heartbeat run ID |
| `PAPERCLIP_TASK_ID` | Issue that triggered this wake |
| `PAPERCLIP_WAKE_REASON` | Wake trigger reason |
| `PAPERCLIP_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `PAPERCLIP_APPROVAL_ID` | Resolved approval ID |
| `PAPERCLIP_APPROVAL_STATUS` | Approval decision |
| `PAPERCLIP_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |

## Memory Engine (Mem0)

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_VECTOR_STORE` | `memory` | Vector backend: `memory` (SQLite per company) or `pgvector` (shared Postgres with `company_id` scoping) |
| `MEMORY_HISTORY_STORE` | `sqlite` or `postgres` | History backend; defaults to `postgres` when `MEMORY_VECTOR_STORE=pgvector`, otherwise `sqlite` |
| `MEMORY_EMBEDDING_DIMS` | `1536` | Embedding dimension; must match pgvector column dimension (`vector(1536)` by default) |
| `MEMORY_DB_PATH` | `.hypowork/mem0/vector_store.db` | Base path for SQLite vector store mode |
| `MEMORY_HISTORY_DB_PATH` | `.hypowork/mem0/history.db` | Base path for SQLite history mode |
| `MEMORY_PGVECTOR_TABLE` | `mem0_vectors` | Table name for pgvector-backed memory rows |
| `MEMORY_PGVECTOR_USER_TABLE` | `mem0_user_state` | Table for per-company `user_id` compatibility state |
| `MEMORY_HISTORY_TABLE` | `mem0_memory_history` | Table name for Postgres history rows |

When using pgvector mode, Postgres must allow `CREATE EXTENSION vector` (migration `0002_mem0_pgvector.sql`). Embedded Postgres does not ship pgvector: the migration still applies `mem0_memory_history` and `mem0_user_state`, and skips `mem0_vectors` until you use a Postgres instance with pgvector installed. Backups should include `mem0_vectors`, `mem0_memory_history`, and `mem0_user_state` when those tables exist.
