# Manual test report — Self-Building Application Factory / Hypowork

**Purpose:** Repeatable checks while moving through [MASTER_PLAN.md](MASTER_PLAN.md) phases. **Update this file** when a phase milestone is reached: add results (date, pass/fail, notes), new cases, or deferrals.

**Rule:** Completing a ProjectPlan phase (merge or sign-off) should include **add or update** rows/sections here so the next run has a baseline.

**How to read this doc**

- **Everyone:** Start with **[Use cases (plain language)](#use-cases-plain-language)** — short “story” checks with everyday wording.
- **Builders / QA:** Use the **phase tables** below for exact clicks, sample text, and optional command-line examples.

---

## Use cases (plain language)

These are **outcomes** a non-technical person can recognize. They map to the same product areas as the phase checklists; engineers can tie failures back to API or server logs.

| # | Scenario | What you do (in the app) | What “good” looks like |
|---|----------|---------------------------|-------------------------|
| UC1 | **Team plans work** | Open your workspace, find **Goals** and **Projects**, open a project | You see a clear place for goals, at least one project, and can open it without errors. |
| UC2 | **Track a concrete task** | In a project, open **Issues**, **create an issue**, give it a short title (e.g. “Review onboarding copy”) | The issue appears on the board/list; you can find it again later. |
| UC3 | **Write shared knowledge** | Open **Documents** (or notes), **create a note**, write a few sentences, save | Text is still there after refresh; others in the org can open it (if your setup allows). |
| UC4 | **Ask the AI about project context** | Open **project chat** (where available), type: *“What should a new teammate know about this project?”* | You get an answer; if documents are linked, the answer may **point to sources** (citations). |
| UC5 | **Get writing help in the editor** | In a document with the rich editor, use **AI completion / copilot** where the product shows it | Suggested text appears; you can accept or edit it. (Technical detail: the server may return a hidden **prompt version id** for quality tracking — you don’t need to see it.) |
| UC6 | **Say if the AI answer was helpful** | After an assistant message in chat, use **thumbs up / thumbs down** if the UI shows them | Your choice saves (no error toast); this feeds **improvement signals** for prompts over time. |
| UC7 | **Run structured product design** | Open a project’s **Design Factory** (or “Design Factory” tab), move through **Refinery → Foundry → Planner → Validator** as the UI allows | Tabs load; you can create or view **requirements / blueprints / work orders** without the app crashing. **Note:** “Work orders” here are **design tasks**, separate from general **Issues** on the board. |
| UC8 | **Optional: agents run assigned work** | If your org uses **AI agents**, assign an issue to an agent and trigger a run (per your admin setup) | A **run** or **heartbeat** shows activity; the issue can move forward when the agent finishes. |

**Sample phrases to paste (for UC4 / UC5)**

- Chat: `What should a new teammate know about this project?`
- Chat: `Summarize risks mentioned in our linked notes.`
- Issue title: `Manual check — planning smoke test`

**Who runs the technical checks?** Anyone can do UC1–UC8 in the browser. The **curl** / JSON sections later are for **developers** validating servers and integrations.

---

## Environment (defaults)

| Variable | Typical value |
|----------|-----------------|
| API base | `http://127.0.0.1:3100` (Hypowork Nest; see server log `Listening on …`) |
| Web UI | Vite dev port from `hypowork/client` (often `5173` or next free) |
| Auth | Local dev often uses **implicit board** session in browser; API tests that need `assertCompanyAccess` require the **same cookies** as the UI or a valid board token. |

Replace placeholders:

- `COMPANY_ID` — UUID of a workspace/company (from UI URL or `GET /api/workspaces` when logged in).
- `PROJECT_ID` — UUID of a project under that company.
- `PROMPT_VERSION_ID` — UUID from `prompt_versions` / agent config UI when applicable.

---

## Phase 0 — Nest / API smoke

| Step | Action | Example to copy | Expect |
|------|--------|-----------------|--------|
| P0.1 | Health | `curl -sS "http://127.0.0.1:3100/api/health"` | JSON with ok / status (not 404) |
| P0.2 | Public skills bundle (no auth) | `curl -sS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3100/api/skills/paperclip"` | `200` |
| P0.3 | Skills index | `curl -sS "http://127.0.0.1:3100/api/skills/index"` | JSON with `skills` array |

**Notes / last run:**

- _Date: ___________ Result: ___________

---

## MVP — Board, documents, issues, agents

Run in **browser** (authenticated) unless you paste a valid session cookie into `curl`.

| Step | Action | Example to type / do | Expect |
|------|--------|----------------------|--------|
| M.1 | Create or open a **Goal** | Sidebar → Goals → New | Goal appears in list |
| M.2 | Create a **Project** | Under goal or Projects → New; name: `QA project manual` | Project opens |
| M.3 | Create an **Issue** | Project → Issues → New; title: `Manual QA smoke issue` | Issue visible; status backlog/todo |
| M.4 | Assign issue | Assign to an **AI agent** or yourself | Assignee shows |
| M.5 | Company **document** | Documents → New note; body: `[[Manual QA]]` and a sentence | Saves; link graph can resolve later |
| M.6 | Agent run (if adapter configured) | Trigger heartbeat / Run from issue (per product UI) | Run appears in heartbeat / run log |

**Sample issue title (paste):** `Manual QA smoke — board + doc link`

**Notes / last run:**

- _Date: ___________ Result: ___________

---

## Phase 1 — Memory, chat, canvas, learner (spot checks)

| Step | Action | Example | Expect |
|------|--------|---------|--------|
| P1.1 | **Project chat** with RAG | Open project-scoped chat; message: `Summarize what we know about this project from linked docs.` | Response; citations if docs indexed; assistant messages may include **`promptVersionId`** when company has seeded `hypowork-default` in `prompt_versions` (for ratings → `POST …/messages/:id/rate`) |
| P1.1b | **Editor copilot** (`POST /api/companies/:id/ai/copilot`) | Trigger block completion in Plate (or `curl` with JSON `{"prompt":"Hello","documentId":"…"}`) | JSON includes **`text`**; may include **`promptVersionId`** when `hypowork-default` is in DB (same dual-loop skill as chat) |
| P1.2 | **Vault** note | Company Vault / notes path per UI; create short note | Persisted |
| P1.3 | **Learner** API (auth required) | See Phase 4 section for shared endpoints; create experiment via UI if exposed | Experiment row or API 2xx |

**Notes / last run:**

- _Date: ___________ Result: ___________

---

## Phase 2 — Software Design Factory (Hypowork)

| Step | Action | Example | Expect |
|------|--------|---------|--------|
| P2.1 | Dev playground project | With `VITE_FACTORY_UI_MOCK=true` (dev), client may call playground ensure; or use **Projects** list for **Factory playground (dev)** | Project exists |
| P2.2 | Open **Design Factory** tab | `Refinery → Foundry → Planner → Validator` | Tabs load |
| P2.3 | **Planner** | Create a work order; title: `WO: manual QA checklist` | WO persists; Kanban/table/Gantt per UI |
| P2.4 | **Track on Issues** (optional) | Link WO to an issue | `linked_issue_id` bridge works |
| P2.5 | Factory **search** | Search box query: `PLC` or requirement keyword | Hits or empty set, no 500 |

**Notes / last run:**

- _Date: ___________ Result: ___________

**Where “code” lives:** Factory artifacts (requirements, blueprints, work orders) are stored in the **Postgres** `software_factory_*` tables. **Generated source code** for an agent is produced in the **adapter working directory** (`cwd` / workspace repo env), not inside those tables as files.

---

## Phase 4 — Self-improvement (Hypowork — DONE)

[phase-4.md](phase-4.md) declared done 2026-03-25. Remaining items (mutation harness, scheduled 6R, wikilink graph, budget dashboard) moved to [phase-6.md](phase-6.md).

### Dual-loop data + promotion

| Step | Action | Example | Expect |
|------|--------|---------|--------|
| P4.1 | Record **task outcome** | `POST /api/companies/COMPANY_ID/task-outcomes` with JSON body (see below) | `{ "id": "…" }` |
| P4.2 | Record **message rating** | `POST /api/companies/COMPANY_ID/messages/MSG_ID/rate` | `{ "id": "…" }` |
| P4.3 | **Metrics** for a prompt version | `GET /api/companies/COMPANY_ID/prompt-versions/PROMPT_VERSION_ID/metrics` | JSON with `compositeScore`, `improvementOverParent`, `confidence`, etc. (**404** if wrong `COMPANY_ID`) |
| P4.4 | **Promote** candidate → baseline | `POST /api/companies/COMPANY_ID/prompt-versions/PROMPT_VERSION_ID/promote` | `{ "ok": true, "skillName": "…", "improvementOverParent": 0.05 }` |
| P4.5 | **Create** prompt candidate | `POST /api/companies/COMPANY_ID/prompt-versions` with body below | `{ "id": "…", "version": 2, "skillName": "…" }` |

**Example body — task outcome (paste and fix IDs):**

```json
{
  "taskType": "manual_test",
  "success": true,
  "criteriaMet": true,
  "errorOccurred": false,
  "durationMs": 1200,
  "budgetUsedCents": 0,
  "promptVersionId": "OPTIONAL-PROMPT-VERSION-UUID"
}
```

**Example body — message rating:**

```json
{
  "rating": 4,
  "thumbsUp": true,
  "feedbackText": "Manual test rating",
  "promptVersionId": "OPTIONAL-PROMPT-VERSION-UUID"
}
```

### Learner loop (in-memory experiments + Vault on keep)

| Step | Action | Example | Expect |
|------|--------|---------|--------|
| P4.5 | Create experiment | `POST /api/companies/COMPANY_ID/learner/experiments` with mission + issueId + agentId | Experiment id returned |
| P4.6 | Run iteration | `POST /api/companies/COMPANY_ID/learner/experiments/EXP_ID/iterations` with artifact body | Iteration metric; on success Vault may get a **lesson** note |

**Example — create experiment body:**

```json
{
  "agentId": "YOUR-AGENT-UUID",
  "issueId": "YOUR-ISSUE-UUID",
  "mission": "Improve README clarity for onboarding",
  "artifactPath": "README.md"
}
```

**Example — iteration JSON body:**

```json
{
  "artifactContent": "# Patch\n\nfunction example() { return 1; }\n"
```

**Example — create prompt candidate (P4.5):**

```json
{
  "parentId": "YOUR-BASELINE-OR-CANDIDATE-UUID",
  "mutationType": "structural",
  "mutatedContent": "You are a senior staff engineer...\n\n## Context\n...",
  "mutationNotes": "Added Context section, reordered Guidelines"
}
```

### Phase 4 completion notes

Phase 4 declared done 2026-03-25. The following items were completed in this session:
- Composite scoring fixed: weights 0.6h / 0.3s / 0.1e, time-decay, min-20 guard
- `promotePromptVersion` now computes `improvementOverParent` and persists updated metrics
- `createCandidate` scaffold added with `mutationType` support
- `promptVersionId` attribution confirmed shipped (was mischaracterized as pending)

**Remaining (moved to [phase-6.md](phase-6.md)):** mutation harness, scheduled 6R, wikilink graph via chat, budget dashboard.

**Notes / last run:**

- 2026-03-25 | PASS | All P4.1–P4.5 endpoints type-check; service logic matches spec


---

## Phase 5 — Zero-Human Runway (DONE)

See [phase-5.md](phase-5.md).

### API coverage (Phase 5 scope)

| ID | Endpoint / Scenario | Expected response | Notes |
|----|--------------------|-------------------|-------|
| P5.1 | **Create pod** | `POST /api/companies/:companyId/pods` with `{ "name": "...", "kind": "general" }` | Returns pod with id, status="active" |
| P5.2 | **List pods** | `GET /api/companies/:companyId/pods` | Returns array; empty if none |
| P5.3 | **Add agent to pod** | `POST /api/pods/:podId/agents` with `{ "agentId": "..." }` | Sets agent.role = "pod:{podId}" |
| P5.4 | **Pod budget policy** | `POST /api/companies/:companyId/budget-policies` with `{ "scopeType": "pod", "scopeId": "...", "amount": 50000 }` | Pod hard-stop blocks pod agent dispatch |
| P5.5 | **CEO agent run** | Timer-triggered run with `adapterType: "ceo"`, reads company/pod/issue state | Report written to run log; no external API calls |
| P5.6 | **getInvocationBlock for pod** | Returns block if pod policy hard-stop exceeded | Pod scoped runs blocked; agent-scoped unaffected |

### Phase 5 completion notes

Phase 5 declared DONE 2026-03-25. All infrastructure is shipped; instantiation remains operational.
- `pods` schema + migration 0054; `podsService` with full CRUD + activity logging
- Pod routes: `POST/GET /companies/:companyId/pods`, `GET/PATCH/DELETE /pods/:podId`, `POST/GET/DELETE /pods/:podId/agents`
- `scopeType: "pod"` in `BUDGET_SCOPE_TYPES`; full pod budget lifecycle in `budgetService`
- `cancelBudgetScopeWork` for pod scope cancels all pod agent active/queued runs
- `ceo` adapter (`adapterType: "ceo"`) reads company budget/pod/issue state; configured via heartbeat.intervalSec
- CEO plan fully implemented: `pending_approval`, `can_create_agents`, permissions, config endpoints, approval revision/resubmit
- CEO plan audit events: `pod.created/lead_updated/status_changed/agent_added/agent_removed/deleted` all logged

**Operational (not code):**
- Hire CEO agent via `POST /api/companies/:companyId/agents` with `role: "ceo"`, `adapterType: "ceo"`, `runtimeConfig.heartbeat.intervalSec: 3600`
- Audit log extension for experiment outcomes: needs DB-backed experiment table (LearnerService is in-memory)

**Notes / last run:**

- 2026-03-25 | PASS | Pods schema, service, routes type-check; pod budget scope type-checks; CEO adapter type-checks


---

## Phase 6 — Chat-Native Knowledge + 6R Automation (NOT STARTED)

See [phase-6.md](phase-6.md). The following are not yet wired:

- Chat-as-editor: create/update notes, add wikilinks via natural language
- `note_links` table for wikilink graph traversal
- `run6RCycle` triggerable from chat or schedule; writes linked notes
- Pattern extraction: LLM analyzes ratings → Vault claims / 6R logs
- Mutation harness: `runPromptEval` + LLM-assisted candidate generation
- Budget / audit dashboard

**Notes / last run:**

- _Date: ___________ Result: ___________


## Changelog

| Date | Phase | Change |
|------|-------|--------|
| 2026-03-24 | — | Initial test matrix + Phase 4 API examples |
| 2026-03-24 | 1 | Editor copilot response may include `promptVersionId` |
| 2026-03-24 | — | Added plain-language use cases (UC1–UC8) for non-technical verification |
| 2026-03-25 | 4 | Fixed composite scoring (0.6h/0.3s/0.1e + time-decay + min-20 guard); wired lineage in promotePromptVersion; added createCandidate scaffold; updated P4.3/P4.4/P4.5 API examples |
| 2026-03-25 | 5 | Shipped pods schema (0054), podsService, pod budget scope in budgetService, cancelBudgetScopeWork for pod, CEO adapter (adapterType: "ceo") |


---

**Next doc:** [phase-6.md](phase-6.md) — Phase 4+5 DONE; Phase 6 (Chat-Native Knowledge + 6R Automation) is next.
