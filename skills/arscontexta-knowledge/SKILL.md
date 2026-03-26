---
name: arscontexta-knowledge
description: >
  Read and write the company knowledge vault and run 6R pipeline steps via the Arscontexta API.
  Use when you need to list vault notes, read/write files, get session context (orient), run
  reduce/reflect/reweave/verify/rethink, check graph health, or trigger self-improvement experiments.
  Always send X-Vault-Path when the company has a configured vault path.
---

# Arscontexta Knowledge Skill

Call the Arscontexta (Hypopedia) backend to operate on a **knowledge vault**: notes, 6R pipeline (reduce, reflect, reweave, verify), graph health, and experiments. Use this for any task that requires reading or updating the company's second brain.

## Configuration

- **Base URL:** `$ARSCONTEXTA_API_URL` (e.g. `http://127.0.0.1:8000`). All paths below are relative to this base.
- **Vault:** Send `X-Vault-Path: <absolute-path>` on every request when the company/agent has a designated vault (e.g. company memory folder). Omit only if using the backend default.

Example headers:

```bash
BASE="${ARSCONTEXTA_API_URL:-http://127.0.0.1:8000}"
VAULT="${ARSCONTEXTA_VAULT_PATH:-}"   # optional; company vault path
curl -sS "$BASE/api/health" \
  $( [ -n "$VAULT" ] && echo "-H \"X-Vault-Path: $VAULT\"" )
```

## Core endpoints

### Health and config

- `GET /api/health` — status and current vault path.
- `GET /api/config/paths` — research_output, learn_output paths.

### Vault and files

- `GET /api/vault/tree` — full tree `{ tree: TreeNode[] }`.
- `GET /api/vault/file/{path}` — read file; path is URL-encoded.
- `PUT /api/vault/file/{path}` — write file; body `{ content: string }`.
- `DELETE /api/vault/file/{path}` — delete file.
- `POST /api/vault/file/rename` — body `{ path, newPath }`.
- `POST /api/vault/folder` — body `{ path }` to create folder.

### Session and planning

- `GET /api/session/orient` — tree, identity/methodology/goals previews, pending_observations_count, pending_tensions_count, suggest_rethink.
- `GET /api/next` — suggested next action and rationale.
- `POST /api/remember` — body `{ content }` to remember content.

### 6R pipeline

- `POST /api/reduce` — body `{ text, workflow_run_id?, referenced_note_paths? }`; returns extracted notes.
- `POST /api/reduce/apply` — body `{ notes, workflow_run_id?, source_text? }` to write notes to vault.
- `POST /api/reflect` — body `{ note_path?, query?, workflow_run_id?, additional_note_paths?, provenance_filter?, auto_enqueue_reweave? }`.
- `POST /api/expand` — body `{ note_path, context_note_paths? }`.
- `POST /api/expand/apply` — body `{ note_path, content }`.
- `POST /api/reweave` — body from reweave payload.
- `POST /api/reweave/from-reflect` — body `{ reflect_run_id? }`.
- `GET /api/reflect/latest-summary` — connections_count, moc_updates_count, report_preview.
- `POST /api/verify` — body `null` or `{ scope?: "schema" }`; returns report, errors, health.
- `POST /api/verify/fix-schema` — apply schema fixes.
- `POST /api/rethink` — run rethink step.

### Graph

- `GET /api/graph/health` — graph health summary.
- `GET /api/graph/orphans` — orphan notes.
- `GET /api/graph/triangles` — triangle stats.
- `GET /api/graph` — nodes and edges.
- `GET /api/graph/backlinks/{note_title}` — backlinks for a note.

### Experiments (self-improvement)

- `POST /api/experiment/run` — body e.g. `{ artifact_path?, vault_path?, metric_name?, time_budget?, write_result_to_vault? }`; returns `run_id`, status.
- `GET /api/experiment/status/{run_id}` — status and result of a run.

### Chat (optional)

- `GET /api/chat/status` — chat status and suggestion_prompts for self-learning.
- `POST /api/chat/suggestions/search` — body `{ query?, message?, k? }`; returns similar_prompts and suggestion_prompts.

## When to use

- **Summarize from vault:** GET tree, then read key files and summarize.
- **Run 6R steps:** Use reduce/reflect/reweave/verify/rethink as needed; check session/orient and next for context.
- **Check health:** GET graph/health and verify; report issues.
- **Trigger experiment:** POST experiment/run with artifact_path and metric; poll experiment/status/{run_id} and report outcome.
