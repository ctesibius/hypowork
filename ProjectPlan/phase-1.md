# Phase 1 — Memory, chat, canvas, learner

**Goal:** Add full institutional memory (Vault + Mem0), chat to notes and ask employees, **Hypopedia-class infinite canvas** on **canvas documents**, **in-document switching between prose and canvas** (Hypopedia / AFFiNE-style: one doc id, two surfaces), and learner agents. Assumes MVP on Nest: company/department, AI + human employees, board (goals/projects/issues), notes/plans, and optional **per-document** prose vs simple canvas ([mvp.md](mvp.md)).

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Phase 1, Chat, Infinite canvas, Selected best patterns) · [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md) (company doc scale + wikilink graph + Mem0/Vault neighborhood)

**Current Status (as of 2026-03-22):**
- ✅ MVP largely complete: org/employees/board/notes/canvas MVP working
- ✅ 3D graph view implemented at `/documents/graph`
- ✅ Document kind (prose/canvas) support exists
- ✅ **Split SSOT storage:** `documents.canvas_graph_json` + `document_revisions.canvas_graph_json`; canonical prose in `latest_body`; migration backfilled legacy combined JSON bodies; client/server PATCH accepts `canvasGraph` + `body` ([docs/canvas-document-separation.md](../docs/canvas-document-separation.md))
- ✅ **Memory engine complete:** @hypowork/mem0 package with SQLite vector store, Mem0-style API
- ✅ **Vault engine:** VaultService with 6R pipeline, claims/skills/MOCs/6R-logs
- ✅ **Chat backend:** ChatService with threads, messages, RAG, streaming
- ✅ **Chat frontend:** Chat page with thread list, messaging, rating widget
- ✅ **Note Viewer:** NotesViewer page with unified search across Mem0 + Vault + Documents
- ✅ **Document mode toggle:** Prose↔Canvas view switch (view switch, not migration)
- ✅ **Canvas elements schema:** `canvas_elements` + `canvas_viewports` tables for private canvas items
- ✅ **Make Standalone API:** Extract selected canvas elements → new document
- ✅ **Canvas node CRUD:** Agent APIs for create/move/connect canvas elements
- ✅ **Learner backend:** LearnerService with experiment loop, metrics, board reporting
- ✅ **Task outcomes wiring:** `PromptLearningService.recordTaskOutcome()` called on experiment completion
- ✅ **Rating wiring:** `prompt_version_id` on ChatMessage, rating passed to API
- ✅ **PromptLearningService:** Composite scoring from ratings + task outcomes
- ✅ **Canvas UI (Phase 1 bar):** React Flow edgeless + **left tool rail + top bar**; **viewport persisted** (`canvas_viewports`); **in-canvas AI** (FAB + docked card, whole-board vs selection, reuse chat APIs); toolbar extracted to `HypoworkCanvasToolbar.tsx`
- ✅ **Canvas link index:** Wikilinks / @-refs from note-card bodies + doc-ref cards → `document_links` on save
- ✅ **Chat API client paths** aligned with Nest (`/api/companies/:id/chat/...`); **GET thread** returns `messages`
- ✅ **Canvas link / dual-note hardening:** `hypowork/server/test/canvas-links-and-memory.vitest-spec.ts` (synthetic Writer + Researcher bodies → link pipeline). Live multi-agent E2E with Mem0/Vault still Phase 2+ if desired.
- ✅ **Track DG (document graph):** `document_links` + prose/canvas synthetic extraction; per-doc links UI; 3D graph + chat/RAG use the same index — see [docs/phase-1-track-dg.md](../docs/phase-1-track-dg.md)

---

## 1.1 Orchestration (Paperclip) — extend MVP

- [x] Paperclip (Nest server) running; MVP org, employees, board, notes in place.
- [x] Org chart can include CEO Agent (or owner as board) and subordinate roles (e.g. Research Director, Design Engineer).
- [x] Goals, projects, issues (from MVP); heartbeat triggers agent runs when issue assigned to AI employee.
- [x] Adapter(s) receiving `contextSnapshot` and invoking agent runtime; agent can report back (comment or status).

## 1.2 Agent runtime & isolation

- [x] Agent runtime (e.g. Claude Code / Cursor) receives wake context (issueId, taskKey, wakeReason, PAPERCLIP_* env vars).
- [x] Optional: isolated git worktree or Docker container per pod for safe artifact editing. ✅ Guidance: [docs/agent-runtime-isolation.md](../docs/agent-runtime-isolation.md), `docker-compose.agent-runtime.example.yml`
- [x] Skills available in runtime: Paperclip skill (wake context, API auth) plus para-memory-files skill exists but not integrated with app memory engines.

## 1.3 Memory engines (dual — use both)

| Engine | Role | Status |
|--------|------|--------|
| **Mem0-style** | Runtime / per-agent memory: fast recall, semantic search, fact extraction. | ✅ Complete - @hypowork/mem0 with SQLite vector store |
| **Vault (Arscontexta-style)** | Shared / long-term: claims, skills, 6R-logs, MOCs. | ✅ Complete - VaultService with 6R pipeline |

- [x] **MemoryModule:** `server-nest/src/memory/` — service, controller, module, types
  - API: `GET/POST /companies/:id/memory`, `GET /companies/:id/memory/search`, `GET /companies/:id/memory/agent-context`
  - Vector store: SQLite-backed MemoryVectorStore with cosine similarity
- [x] **Knowledge skill integration:** Paperclip skill updated with memory endpoints and usage guidance
- [x] **Mem0 engine:** Full vector search, fact extraction, company-scoped instances
- [x] **Vault engine:** VaultService with claims, skills, 6R-logs, MOCs, 6R pipeline (reduce, reflect, reweave, verify, rethink)
- [x] At least two agents (e.g. Writer, Researcher) on a shared company story — **synthetic / link-index level:** canvas markdown extraction test merges two agent stickies + wikilinks (`hypowork/server/test/canvas-links-and-memory.vitest-spec.ts`). Full wake-to-Mem0 E2E deferred.
- [x] Optional: keyword/full-text search alongside vector search; doc-scoped or link-neighborhood RAG (see 1.7). ✅ `keyword` on memory search; ChatService document neighborhood RAG + excerpts (`document-rag-excerpt.util.ts`, `buildDocumentNeighborhoodRagLinks`).
- [x] **Company doc link neighborhood:** Document links (wikilinks/@) extracted and stored; 1-hop neighborhood API via `documents.links()`.

## 1.4 Autoresearch-style loop (metric → edit → run → keep/discard)

- [x] Learner/Researcher agent: read mission → edit single artifact → run eval (e.g. 5-min budget) → parse metric → keep or discard.
- [x] Loop integrated with Paperclip: learner receives heartbeats; posts experiment summaries as issue comments or new issues.
- [x] Optional: learner writes "lessons" or best config into company vault after kept experiments.

### 1.4.1 Task Outcome Tracking (Automated Feedback Signals)

**Why now:** Every agent task execution produces implicit signals (success/failure, time, budget) — no human needed. These feed the dual-loop learning system (§4.x).

- [x] **Task outcomes table:** `task_outcomes` — id, task_id, agent_id, company_id, prompt_version_id, task_type, success, criteria_met, error_occurred, error_type, duration_ms, budget_used_cents, complexity_estimated, complexity_actual, created_at.
- [x] **Record outcomes:** `PromptLearningService.recordTaskOutcome()` wired to `LearnerService` on experiment completion. Heartbeat wiring deferred to Phase 2. ✅
- [x] **Connect to learner experiments:** `LearnerExperiment` records its `MetricResult` to `task_outcomes` so both automated and human signals share the same store. ✅
- [x] **Minimal viable scoring:** Composite metric via `PromptLearningService.computeCompositeScore()`: `0.3 * rating_score + 0.7 * success_rate * efficiency_score`. ✅

## 1.5 Visibility (founder layer)

- [x] Note Viewer: live search across Mem0 + Vault (NotesViewer page with unified search).
- [x] Rendered, linked views of notes/claims/docs; project milestones and experiment history visible.
- [x] Optional: mobile-friendly dashboard for monitoring. ✅ Compact horizontal metric strip on `<md` (`Dashboard.tsx`)

## 1.6 Chat (Phase 1) — chat to notes, ask employee

- [x] **Chat UI:** Dedicated chat surface (sidebar or tab); thread list and active thread view. ✅ Chat page at `/chat`
- [x] **Chat to notes:** User question → RAG from Vault + Mem0 → LLM with citations; response streams with source links. ⚠️ Backend exists, streaming partial
- [x] **Citations from company docs:** When the user scopes chat to a **company document**, RAG includes **linked docs** (out/in graph) — same pattern as link-neighborhood in §1.3. ✅ Via ChatService
- [x] **Ask employee (agent):** User selects agent; query that agent's known info (Mem0 scoped + Vault); answer in chat with citations. ✅ Via askAgent endpoint
- [x] **Threads & streaming:** Threads persisted; responses streamed (SSE or WebSocket); recent turns in context (e.g. last 10). ⚠️ Backend partial
- [x] **Model-agnostic backend:** Single chat API (Claude / GPT / Grok / local); same thread storage and UX. ✅

**Global shell (Phase 1 UX):**
- [x] **Omnipresent chat panel:** `GlobalChatSheet` (FAB + slide-over, ⌘⇧C), hidden on `/chat`; **canvas** still uses in-surface AI per **§1.6.2** / **§1.7h**.

### 1.6.2 In-canvas AI assistant (Phase 1 — canvas-native)

**Goal:** On **canvas documents** (and company canvas board), AI chat is **embedded in the canvas UI** — not the primary UX pattern of “leave the board to open `/chat`”.

- [x] **Entry:** Floating action button and **dockable card** (minimize/expand) anchored to the canvas (`CanvasAiAssistant.tsx`).
- [x] **Scope (explicit):** **Whole board** (serialized nodes/edges + doc metadata in the user message) vs **Selection** (single selected node; uses `POST .../messages/with-context` + `CanvasNodeContextForChat`).
- [x] **Reuse backend:** Same `createThread` / `sendMessage` / `sendMessageWithCanvasContext` as Chat; document-scoped thread when `documentId` is set; session thread id in `sessionStorage` per board.
- [x] **Full `/chat` route:** Link **Open full Chat** (`../chat`); deep link from “Ask about this” uses relative `../chat?context=…&doc=…`.

### 1.6.1 Rating Capture (Human Feedback Signals)

**Why now:** Rating capture during chat is low-effort, high-impact — every user interaction becomes training data for prompt improvement. Humans rate responses while chatting; no additional workflow needed.

- [x] **Message ratings table:** `message_ratings` — id, message_id, company_id, user_id, rating (1–5), thumbs (boolean), feedback_text, aspect, prompt_version_id, created_at.
- [x] **Rating widget:** After each agent response, show 👍 / 👎 / ⭐ (1–5); optional text field for detailed feedback. ✅ In Chat page
- [x] **Track prompt version:** `ChatMessage` includes `prompt_version_id`; `handleRate` passes it to `rateMessage` API. ✅
- [x] **Aggregate ratings:** `PromptLearningService.getPromptMetrics(promptVersionId)` → `avg_rating`, `response_count`, `thumbs_up_rate`. ✅
- [x] **Promote prompt version (API):** `POST /companies/:id/prompt-versions/:promptVersionId/promote` — baseline demotion + promote in one transaction (`PromptLearningService.promotePromptVersion`). UI optional / later.

## 1.7 Infinite canvas (Phase 1) — Hypopedia-style, per canvas document

**Product shape:** The **infinite edgeless surface** is tied to **company documents of kind Canvas** (see [mvp.md](mvp.md)), not a separate "one canvas per org" unless you also keep a pinned **home** canvas doc. **Phase 2–3** Factory canvases **reuse this engine** with project-specific node types ([phase-2.md](phase-2.md) §2.8, [phase-3.md](phase-3.md) §3.8).

**Reference:** Hypopedia / AFFiNE-style — edgeless plane, tools, embeds, connectors, **page vs edgeless on the same document**, and **view** (read/presentation) where product needs it. Product reference: local Hypopedia clone (`/Users/bnguyen/Desktop/Github/Hypopedia`) — `docs/design/` (e.g. architecture, edgeless); handoff summary: [hypopedia-canvas-architecture-study.md](hypopedia-canvas-architecture-study.md).

### 1.7a — Engine & viewport

- [x] **Edgeless plane + viewport:** React Flow pan/zoom; **camera persisted** per canvas document via `GET/PATCH .../canvas-viewport` (default user viewport) and `onMoveEnd` debounce in `DocumentCanvasEditor`.
- [x] **Selection & layout basics:** Move, connect, select; resize/z-order; **snap-to-grid toggle** + **frame** node type — ⚠️ z-order polish still backlog
- [x] **Hypopedia-class chrome:** Docked **left tool rail** + **top bar** in `HypoworkCanvasToolbar.tsx` (Hypopedia-style layout; undo stack later).

### 1.7b — Data model & persistence

- [x] **Graph storage:** Nodes and edges (ids, type, bounds, payload) stored; basic load/save working. ✅ Canvas documents store JSON in body field
- [x] **Link to artifacts:** Nodes can reference **company docs**, **issues** via linking. ✅ Basic linking exists

### 1.7c — Tools (baseline)

- [x] **Drawing tools:** Shapes, text, connector tool; **frame** tool for clustering. ⚠️ Groups/undo advanced backlog
- [x] **Embeds / doc nodes:** **DocRef** fetches document and shows **text preview**; click-through to full document where routed. ⚠️ Rich embeds / diagrams backlog

### 1.7d — View & presentation

- [x] **View mode:** Presentation-style read-only view for canvas docs (eye icon in toolbar, minimal chrome, pan-only). Toggled via `viewMode` prop on `DocumentCanvasEditor`. ✅
- [x] **Node selection:** Selecting a node fires `onNodeSelect(nodeId, context)` with selected + neighbors + doc refs. ✅

### 1.7e — Intelligence & graph alignment

- [x] **Link-scoped RAG (interim):** “Ask about this” can open full Chat with `?context=` + node neighborhood; backend builds context from selected node + neighbors + linked docs. ✅ **Superseded on canvas by §1.6.2** (in-surface assistant) when implemented — keep deep link as optional “open in Chat”.
- [x] **Track DG (wiki / doc graph):** [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md) — `[[wikilink]]` + `@` + canvas synthetic lines (`syntheticMarkdownFromCanvasGraphBody`, docRef → `@uuid`) → `document_links`; per-doc `GET .../links`; company `GET .../graph` for §1.9; aligns with chat neighborhood. ✅ Details: [docs/phase-1-track-dg.md](../docs/phase-1-track-dg.md)

### 1.7f — Agents

- [x] Agents can **create/move/connect** nodes via REST APIs:
  - `POST /documents/:id/canvas-elements` — add element
  - `PATCH /documents/:id/canvas-elements/:elementId` — update (move/resize)
  - `POST /documents/:id/canvas-edges` — connect two elements
  - All routes respect `assertCompanyAccess` ✅

### 1.7g — Document mode: prose ↔ canvas (Hypopedia-aligned)

**Product shape (match Hypopedia / AFFiNE):** One **company document** keeps a **single id**, **single list row**, and **same route** (`/documents/:id`); the user switches the **active surface** between **Document / page (markdown prose)** and **Canvas / edgeless (spatial graph)** — **NOT a transformation, a VIEW SWITCH**.

**Single surface at a time (Hypopedia parity):** For a given document you **either** see the **page/prose** experience **or** the **canvas/edgeless** experience — **not both full editors at once**, regardless of how many nodes/embeds/issues exist on the canvas. The stored `kind` (+ optional presentation `viewMode` on canvas) picks **one** renderer; switching modes swaps the whole content area, like Hypopedia’s page vs edgeless toggle.

**Critical insight:** When switching views, the document **does not transform**. In canvas view, the document appears as a **Note card** (read-only or editable). User-added canvas elements (shapes, connectors, annotations) are **private to the canvas view** and do not modify the original document.

```
Document (same id, same route, unchanged)
├── Page view → prose editor renders document.body
└── Canvas view
    ├── Document shows as a Note card (read-only or editable)
    ├── + Private canvas items (user-added shapes, connectors, annotations)
    └── Make Standalone → creates NEW document from selected canvas items
```

- [x] **Chrome UX:** Toggle control (e.g., "Page" | "Canvas") on document detail; after switch, load correct editor without changing URL. ✅ Mode toggle buttons in toolbar
- [x] **View switch (not migration):** Switching to canvas does NOT transform document content. ✅ DocumentModeService + DocumentModeController
  - Document body renders as a **Note card** in the canvas
  - User can add canvas-only elements (shapes, connectors, frames) that are **private** to this canvas view
  - Switching back to Page view leaves document unchanged (private canvas items preserved in canvas state)
- [x] **Canvas elements storage:** `canvas_elements` + `canvas_viewports` tables store private canvas items separately from document body ✅
- [x] **Make Standalone API:** POST `/documents/:id/make-standalone` → creates NEW document from selected elements ✅
- [x] **Private canvas items:** Elements stored with `isPrivate=true`; cascade-deleted with document ✅
- [x] **Link index for canvas:** `syntheticMarkdownFromCanvasGraphBody()` — wikilinks / @-mentions in **sticky/sketch/docPage** bodies + **`@uuid` from docRef cards** → `replaceDocumentLinksForSource` (same pipeline as prose).
- [x] **Agents (with §1.8):** Agents may create/update documents with either `kind` using the same Nest document APIs; canvas element APIs exist ✅

**Deferred (optional / later):**
- Real-time multiplayer CRDT for canvas collaboration
- Full plugin marketplace, comment threads on canvas
- Inline editing of Note cards within canvas view

### 1.7h — Code organization, Hypopedia reuse, in-surface AI

**Colocation rule (Hypowork client):** All **canvas-specific UI** (boards, document canvas editor, toolbars, node renderers, canvas-local hooks, in-canvas chat shell) lives under **`hypowork/client/src/components/canvas/`**. **Exceptions:** shared utilities used outside canvas stay in `lib/` (e.g. `canvasGraph.ts` serialization), `api/*`, and **packages** (`@paperclipai/*`, `@hypowork/*`). If a helper is **only** used by canvas, prefer `components/canvas/` (e.g. `components/canvas/lib/`) or `lib/canvas/` as a later tidy.

- [x] **Refactor for clarity:** `HypoworkCanvasToolbar.tsx` extracted; `CompanyCanvasBoard.tsx` holds shared React Flow **node type map** + node components (legacy per-company `/canvas` page removed — canvas lives on **canvas** documents only).
- [x] **Page shells stay thin:** No new canvas primitives added under `pages/` in this pass.

**Hypopedia / AFFiNE port (local clone):** Canonical external tree: **`/Users/bnguyen/Desktop/Github/Hypopedia`**. Implementation map already in [hypopedia-canvas-architecture-study.md](hypopedia-canvas-architecture-study.md) (BlockSuite surface, elements, tools).

- [x] **License & scope:** **Patterns only** in-repo; no BlockSuite paste — recorded in [docs/phase-1-canvas-renderer-decision.md](../docs/phase-1-canvas-renderer-decision.md).
- [x] **Pragmatic port order (Phase 1):** (1) Tool rail + top bar ✅ (2) connectors + frame + snap ✅ (React Flow MVP) (3) BlockSuite spike deferred — see decision doc.
- [x] **In-surface AI:** `CanvasAiAssistant.tsx` (FAB + card) + `canvasChatContext.ts`.

## 1.8 Agent-authored company documents & deliverable pattern

**Why:** Issues and comments are for **coordination**; **company documents** (hypowork standalone markdown — same routes as human users, e.g. `/…/documents/:id`) are **durable artifacts** (SOPs, policies, runbooks, project plans). Phase 1 must make agent **authorship** of those documents a first-class goal, not only Vault/Mem0 notes or issue threads.

- [x] **APIs/tools:** Agent runtime can **create** and **update** company documents (prose or canvas kind) via the same Nest/document APIs using **agent-authenticated** requests. `createdByAgentId` / `updatedByAgentId` fields exist.
- [x] **Deliverable model (product):** Documented in [docs/issue-deliverable-model.md](../docs/issue-deliverable-model.md) (issues vs company documents vs Vault/Mem0).
- [x] Optional: **Link issue ↔ document** — on successful **Link issue** from document detail, posts an **issue comment** with document title + path (`DocumentDetail.tsx` + `issuesApi.addComment`).

## 1.9 Company document graph view (3D) — Hypopedia-style, `3d-force-graph` engine

**Not the same as §1.7:** This is the **global link graph** — **nodes = company documents**, **edges = derived links** from the wikilink / `@` index (`document_links`, Track DG in [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md)). §1.7 is the **per-document edgeless canvas** (authoring board). Both are Phase 1 if you want parity with Hypopedia's split: **graph page** vs **doc canvas**.

**Reference implementation to study and vendor:**

- Local upstream / reference tree: **`3d-force-graph-master/`** in this workspace (same patterns as Hypopedia's vendored copy under `graph-page/lib/3d-force-graph/`).
- Hypopedia contract: `docs/design/graph-view.md` in the local Hypopedia clone (e.g. `/Users/bnguyen/Desktop/Github/Hypopedia/docs/design/graph-view.md`) — must-have behaviors: force layout, orbit/pan/zoom, progressive loading, filter, preview panel, edge direction cues, theme.

**Checklist**

- [x] **Data:** Build `GraphData { nodes, edges }` from company `document_links` (and backlinks); filtering per graph-view spec. ✅ API: `documentsApi.graph()`
- [x] **Engine in-repo:** **Vendored `3d-force-graph` stack** in `@hypowork/doc-graph-3d` package — MIT licensed, Three.js used via 3d-force-graph. ✅
- [x] **UI route:** Dedicated graph view at `/documents/graph` — open doc from node (navigates to `/documents/:id`). ✅
- [x] **Alignment:** Reuse the same link index as §1.3 / §1.6 neighborhood and §1.7e (one source of truth for edges). ✅

**Deferred (optional / later):** 3D stack swap (e.g. R3F) as long as the **graph-view.md** contract is preserved — same idea as Hypopedia's "replace renderer, keep data contract."

---

## Phase 1 done when

- [x] Full memory (Vault + Mem0) is live; agents write notes to shared memory; Note Viewer shows results.
- [x] **Agents can create/update company documents** where tasks call for published org artifacts (see §1.8), not only issue comments or internal vault files. ✅ APIs exist
- [x] Chat to notes (RAG + citations) and ask any employee work; **company documents** support **prose ↔ canvas view switch** on the same artifact (§1.7g, Hypopedia-style, view not migration); **canvas** documents provide **Hypopedia-aligned canvas** (React Flow + tool chrome, viewport persistence, in-canvas AI, doc cards, link index). ⚠️ Deeper drawing/frame tooling optional backlog
- [x] **Company document link graph** (§1.9): 3D graph view over the org's notes using a **vendored `3d-force-graph`-based engine**. ✅
- [x] Learner agent runs experiments and reports to the board. ✅ LearnerService implemented
- [x] **Dual-loop learning infrastructure:** task_outcomes + message_ratings + prompt_versions schemas wired to LearnerService + ChatService + PromptLearningService ✅
- [x] **Canvas agent APIs:** Create/move/connect nodes via REST endpoints ✅
- [x] **View switch infrastructure:** canvas_elements, canvas_viewports, Make Standalone ✅

**Phase 1 checklist:** closed (last open item was §1.7e Track DG — verified implemented, see [docs/phase-1-track-dg.md](../docs/phase-1-track-dg.md)).

**Deferred (Phase 2 or backlog):**
- Canvas UX: advanced groups, undo stack, richer diagram/embed surfaces
- Live multi-agent E2E against Mem0 + Vault (beyond synthetic link tests)
- Prompt **learning policy** / auto-promote rules — Phase 4 (promote **API** exists in Phase 1)

**Next:** [phase-2.md](phase-2.md) — Software Design Factory.
