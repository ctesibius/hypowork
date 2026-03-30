# Phase 2 — Software Design Factory

**Goal:** Refinery → Foundry → Planner → Validator for software; you or a designated agent iterates, plans (project plan + work orders), designs, draws diagrams, takes notes.

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Phase 2)

**Hypowork status (2026-03-23):** First executable slice lives in the `hypowork/` monorepo (Nest + existing React client), not a separate Next/FastAPI app. **Board `project` = software initiative.** Tables: `software_factory_*` (migration `0044_software_factory`); **company documents ↔ projects:** nullable `documents.project_id`, `projects.planning_canvas_document_id` (migration `0045_document_project_canvas`); **PLC templates:** `plc_templates` + `projects.plc_template_id` + `software_factory_work_orders.plc_stage_id` (migration `0047_plc_templates`); **WO ↔ issue:** `software_factory_work_orders.linked_issue_id` → `issues.id` (migration `0046_factory_template_planner_fts`). **API:** `GET …/documents?projectId=`; `POST/PATCH` company documents accept `projectId`; `PATCH /projects/:id` accepts `planningCanvasDocumentId` + `plcTemplateId`; PLC CRUD at `/companies/:companyId/plc-templates`; `GET /requirements/:id`, `GET /blueprints/:id`, `GET /work-orders/:id` for live canvas card rendering; factory **global search** (`GET …/software-factory/search`) with ranked FTS on requirements + `ilike` across artifacts. **UI:** project **Overview** lists project-scoped notes, **Create planning canvas**, **New note**; factory **Foundry** blueprint **Linked requirements** checkboxes; **Planner** list / **board (Kanban)** / **table** / **Gantt** with persisted view mode; Kanban **cross-column drag** updates WO `status`; Kanban **full-height column UX** (hidden scrollbars + horizontal arrow strip) aligned with project **Issues** board; **board/table/gantt** use a right **sheet** for WO create/edit to maximize planner space; **Track on Issues** + **Open linked issue** on work orders; **PLC stage picker** in WO create/edit + project properties; **PLC template editor** at `/company/settings/plc-templates`; **project canvas** with `requirementRef`, `blueprintRef`, `workOrderRef` nodes (live API cards). **Design reference:** [hypowork/doc/software-foundry.md](../hypowork/doc/software-foundry.md), [docs/design/plc-templates.md](../docs/design/plc-templates.md). **Shipped (Phase 2 MVP):** project-scoped chat + RAG; factory full-text search; WO↔issue bridge; planner Kanban/Gantt/table + DnD status; planner sheet authoring; **WO assignee** picker in meta + **assignee labels** on Kanban cards and table column (`sfWorkOrderAssigneeDisplay`); PLC template binding; WO PLC stage tagging; PLC graph layer on canvas; **PLC `stage` nodes show WO status rollup** on project-tagged planning canvas; PLC template editor UI; project canvas factory nodes. **Deferred (stretch / later phases):** Requirements debater agent.

---

## IA and terminology (target UX — software now, hardware Phase 3)

### Project shell: **Design Factory** tab

- **Tab label (exact UI copy):** **Design Factory**.
- **Placement:** First-class tab alongside **Overview**, **Issues**, **Configuration**, **Budget** (plugin tabs unchanged). Suggested order: **Overview → Issues → Design Factory → Configuration → Budget**.
- **Behavior:** Selecting **Design Factory** opens the existing four-stage experience (**Refinery → Foundry → Planner → Validator**) in the same project context. URL may stay `…/projects/:ref/factory` or gain an alias `…/design-factory`; the **user-facing name** is always **Design Factory**.
- **Shipped:** No separate “software factory” link above tabs — **Design Factory** is the entry point.

### Planner **work orders** vs **Issues** (board)

| | **Issues** | **Planner work orders** |
|---|------------|-------------------------|
| **Purpose** | General project execution on the board (bugs, tasks, requests). | **Design-factory** execution units tied to requirements / blueprints / Validator. |
| **Data** | `issues` + assignees, heartbeats, inbox. | `software_factory_work_orders` (+ deps, factory links). |
| **Rule** | Two systems of record; do not merge tables. | WOs stay authoritative for the factory pipeline. |

**Optional bridge:** When board visibility is needed (inbox, heartbeat, mixed assignees), support **“Track on Issues”** — e.g. optional `linked_issue_id` on a work order (or inverse link on the issue), **one linked pair**, not duplicated narratives.

### Work orders vs **project lifecycle gates** (kickoff, PDR, CDR, TRR, …)

They are **not the same abstraction**:

- **Gates** (PLC-style) are **phase milestones / decision points**: scheduled reviews, go/no-go, documented outcomes. They are **time-anchored** and often **package multiple artifacts**.
- **Work orders** in the Design Factory are **granular executable units** (“implement API X”, “run FEA”, “fix CI”) with status, deps, and assignees.

**How they fit together in the plan:**

- A gate can be **represented as** one or more work orders (e.g. WO “Prepare and hold PDR” with checklist in `description_md`), **and/or** as **canvas / document nodes** (see §2.8 PDR → CDR), **and/or** as **requirements** (“Exit criteria for CDR”).
- Later, an optional **`kind` or tag** on work orders (e.g. `milestone`, `gate`) can make gates first-class in Planner without renaming “work order” globally.

### **Factory template** (future — cross-discipline)

- Add a **project-level** field (e.g. `factory_template` or `project_kind`): `software` | `hardware` | `hybrid` | `none`.
- **Same** shell: **Design Factory** tab + **Refinery → Foundry → Planner → Validator** labels.
- **Implementation:** keep `software_factory_*` for software; add `hardware_factory_*` (or equivalent) for Phase 3 with a **shared UI shell** and template switch — avoid separate product metaphors per discipline.

---

## Execution order (UI → API)

1. **Dev playground (real data, same UI as prod):** With `import.meta.env.DEV` and `VITE_FACTORY_UI_MOCK=true`, the client calls `POST /companies/:id/software-factory/dev/ensure-playground-project` (Nest; blocked in production unless `ALLOW_FACTORY_PLAYGROUND=1`). That **idempotently** creates a normal project named **Factory playground (dev)** and seeds `software_factory_*` rows if empty. Open it from the **Projects** list in the sidebar — Issues, documents, factory, etc. use the **exact** app shell and APIs. Planner **view mode** still uses `localStorage` per company + project. **SSOT:** `software-factory-planner.ts` ports + typed adapters (`SfWorkOrder` vs issues).
2. **Turn off the flag** when you do not want auto-ensure on load; the playground project remains in the DB until you delete/archive it.
3. **Stretch backlog:** vector semantic search, MCP/agent surfaces, Mermaid-on-canvas, Vault sync, Design Engineer agent — see **§ Phase 2 MVP vs stretch** below.

---

## 2.1 Core platform

- [x] New app or module: “Software Factory” (Refinery, Foundry, Planner, Validator). Stack: e.g. Next.js + FastAPI or full Node. *(Delivered as Nest module + hypowork client; not separate app.)*
- [x] Auth and project CRUD; one project = one software initiative. *(Reuses board auth + existing `projects`; factory rows scoped by `company_id` + `project_id`.)*
- [x] **Design Factory** project tab (label exactly **Design Factory**), peer to Overview / Issues / Configuration / Budget; route `…/projects/:ref/factory` renders the same shell with the tab selected.
- [x] Optional: work order ↔ issue **link** (`linked_issue_id`) + **Track on Issues** / **Open linked issue** in Planner WO meta (`software_factory_work_orders.linked_issue_id`, Nest validation on patch).
- [x] Future: `factory_template` / `project_kind` on `projects` to select software vs hardware factory module (Phase 3); same tab name **Design Factory**. *(Done — `factoryTemplate` field on schema, types, validators, and ProjectDetail UI.)*

## 2.2 Refinery (requirements)

- [x] Collaborative requirements refinement: markdown + structured (e.g. YAML); versioning. *(Markdown + optional `structured_yaml` text + `version` column; collaboration via existing company access.)*
- [x] **Full-text** search over Refinery (ranked FTS + `ilike` fallback) and company-wide **text** search across requirements / blueprints / work orders / validation events (`software-factory.service` global search). *(UI: factory search bar on Design Factory page.)*
- [x] **Vector / semantic** search over requirements (embeddings JSON column + cosine similarity; `GET …/search?mode=semantic`); embedder auto-initialized from `MEMORY_EMBEDDER_*` env vars (OpenAI/Ollama); falls back gracefully when unavailable.
- [ ] Optional: requirements debater agent (suggest/add/refine items).

## 2.3 Foundry (architecture / blueprints)

- [x] Blueprints: high-level architecture, system diagrams (e.g. Mermaid or block-diagram renderer). *(Markdown body in Plate + `diagram_mermaid` field; **Mermaid preview** beside diagram source; single Plate editor for markdown bodies.)*
- [x] Documents editable by human or agent; link to Refinery requirements. *(API: `linked_requirement_ids` JSON array; **Foundry** checklist UI.)*
- [x] **Blueprint generator agent:** instruction set in [software-factory-agents.md](../hypowork/doc/software-factory-agents.md) — paste into agent’s instructions file; drafts architecture blueprints from requirements via factory API.

## 2.4 Planner v2 (work orders)

- [x] Work orders: break intent into structured tasks; assign to agents or human. *(CRUD + `assignee_agent_id` / `assigned_user_id` on schema/API.)*
- [x] Work order **assignee / user picker** in Planner WO meta panel (list + sheet): **Unassigned**, **Me** (session user), company **agents** (non-terminated), `PATCH` `assignee_agent_id` / `assigned_user_id`; preserves unknown/terminated assignee in dropdown until changed.
- [x] **Assignee on planner board/table:** Kanban cards and table view show resolved assignee label (agent name or user / Me) via `sfWorkOrderAssigneeDisplay` + `buildPlannerKanbanPort(..., assigneeLabelFor)`.
- [x] **Gantt** (timeline) view in Planner from `planned_start_at` / `planned_end_at` (or `created_at` / `updated_at` fallback); bars selectable → edit sheet.
- [x] **Kanban:** columns by `status`; **cross-column drag-and-drop** persists status via `PATCH` work order; horizontal strip UX (no scrollbar + chevrons) + full-height columns; **`depends_on_work_order_ids`** on schema for deps display.
- [x] **PLC stage tagging:** work orders tagged to a PLC stage node (`plc_stage_id`) from the project's bound `plc_template_id`. *(Stage picker in WO create/edit; factory playground seeds a "Standard SW PLC" template.)*
- [x] MCP / REST API surface for coding agents (`packages/mcp` — `@modelcontextprotocol/sdk` stdio server; tools: `list_work_orders`, `get_work_order`, `create_work_order`, `patch_work_order`, `batch_patch_work_orders`, `list_requirements`, `search_requirements`, `list_blueprints`).
- [x] Global search across projects, requirements, blueprints, work orders. *(Plus validation events in same search endpoint.)*

## 2.5 Validator (feedback → tasks)

- [x] Ingest feedback (e.g. CI results, review comments); turn into actionable tasks or work orders. *(Validation events + optional auto–work order create.)*
- [x] **Validation fixer agent:** instruction set in [software-factory-agents.md](../hypowork/doc/software-factory-agents.md) — classifies validation events (flake / real defect / infra / missing test), creates work orders via factory API, traces to requirements/blueprints.

## 2.6 Integration with Phase 1

- [ ] Paperclip “Design Engineer” or “Software Factory Runner” agent: drives Software Factory (create/update project plan, work orders, diagrams, notes).
- [ ] Factory documents and notes synced or mirrored into in-app Vault (and optionally Mem0).

## 2.7 Chat (Phase 2) — Software Factory scope

- [x] **Project-scoped chat (MVP):** Threads carry `projectId`; list/filter + create from Chat with `?project=`; factory assist links there. **RAG** merges requirement/blueprint/work-order/validation excerpts for that project when building context. *(Citations UX / org doc neighborhood / “ask runner” still below.)*
- [x] RAG pulls **project-scoped company documents** (`documents.project_id` = thread’s board project, standalone notes only).
- [x] **Org-level company documents** in RAG: `loadOrgLevelDocumentRagExcerpts` in `ChatService` adds all non-issue company docs (deduplicated, lower score) so threads have broad org context beyond project scope.
- [x] **Chat to refine requirements / blueprints:** “Try in chat” prompts in `FactoryAssistPanel` open chat pre-filled (`?prompt=` param → `CompanyChatWorkspace` auto-sends); factory RAG provides requirements, blueprints, WOs, and validation as context; citations render in `ChatMessageBubble`.
- [x] **Ask employee in Factory context:** `showAgentsFooter` in `CompanyChatWorkspace` lists agents; click pre-fills `@agent-name:` in composer and routes thread to that agent via `agentId` on the thread.
- [x] **Create/update WO from chat:** `CheckSquare` button in composer (visible when `projectIdFilter` set) opens confirmation dialog; `createWorkOrder` mutation; WO appears in Planner immediately.

## 2.8a Factory authoring UX (Plate + assist)

- [x] **Document-grade markdown:** Same **Plate full-kit** as company documents for requirement / blueprint / work-order bodies (`fullBleed` + same **Layout** main shell as document detail so the editor gets viewport height; debounced save to Nest).
- [x] **Side panel:** Per-stage assist column (guidance + link to company chat); placeholder for future project-scoped RAG / “factory copilot”.
- [x] **Planner compact authoring:** Board / table / Gantt use a **right sheet** for new WO + edit (title, markdown, status, meta) so the planner surface stays full-height.
- [x] **Embedded AI:** `FactoryAssistPanel` prompts link to `chat?project=...&prompt=...` (auto-send); project-scoped chat via `CompanyChatWorkspace` with `projectIdFilter`; factory RAG includes org-level docs, requirements, blueprints, WOs, validation; citations render in `ChatMessageBubble`. (Global chat FAB covers this throughout the app.)
- [x] **Wikilink / `@` picker** in factory editors (`DocumentLinkPickerProvider` + same resolve path as documents).
- [x] **Mermaid preview** in Foundry (live render next to `diagram_mermaid` source via shared `MermaidDiagram`; Refinery/Planner/Foundry markdown = one Plate editor per row, no duplicate read-only pane).

## 2.8 Infinite canvas (Phase 2) — Software Factory

**Reuse:** Build on the **Phase 1 canvas engine** ([phase-1.md](phase-1.md) §1.7) — edgeless surface, persistence, tools, embeds, view — and add **Factory-specific** node types, templates, and project scope.

- [x] **Project canvas:** Each Software Factory project has an infinite canvas; nodes = requirements, blueprints, work orders, notes. **Canvas document** (`kind=canvas`) opened from project overview renders `DocumentCanvasEditor` with factory toolbar: Requirement (green), Blueprint (blue), Work Order (orange) card nodes, each fetched live from the API and linked to their detail pages. **Toolbar:** left-rail icon buttons + top-bar buttons with pickers for all three types. **Backend:** `GET /requirements/:id`, `GET /blueprints/:id`, `GET /work-orders/:id` added for live card rendering.
- [x] **Diagrams on canvas:** `mermaid` node type added to `hypoworkCanvasNodeTypes`; editor + live preview in node; toolbar button to add; persists `source` in graph JSON.
- [x] **PDR → CDR flow (PLC as data model):** `plc_templates` table + `projects.plc_template_id` + `software_factory_work_orders.plc_stage_id` (migration `0047_plc_templates`). Projects bind a PLC template; WOs tag to a stage. **UI:** PLC template selector in project properties; stage picker in WO create/edit.
- [x] **PLC graph layer on canvas:** `mergeDesignFactoryLifecycleIntoCanvas` accepts PLC template stages dynamically; "Add {template name}" button on the project overview uses the actual stage nodes.
- [x] **PLC stage status on canvas:** For **project-scoped** canvas documents, `stage` nodes show rollup from work orders where `plc_stage_id` equals the node id (`aggregatePlcStageFromWorkOrders` in `canvasGraph.ts`): **No work orders** (empty), **In flight** (todo/in_progress), **Blocked**, **Complete** (all done/cancelled); border/background cues on the node. Wired via `CanvasChromeContext.projectWorkOrders` from `DocumentCanvasEditor`.
- [x] **PLC template editor UI:** Full CRUD at `/company/settings/plc-templates` — list/create/edit/delete templates; stage graph builder (add/remove/reorder nodes, kind selector, edge auto-wiring by order).
- [x] **Sync to Vault:** `POST /companies/:companyId/vault/sync-canvas-topology` writes canvas graph JSON as a Vault `note` tagged `canvas:{documentId}`; called on every canvas save in `DocumentCanvasEditor.performSave`.

---

## Phase 2 MVP vs stretch (Hypowork closure)

| Area | MVP (met in `hypowork/`) | Stretch (still open in this doc) |
|------|---------------------------|----------------------------------|
| Factory pipeline | Refinery / Foundry / Planner / Validator with real persistence + UI | — |
| Planner | List, board (DnD Kanban), table, Gantt; sheet create/edit; assignee picker + labels on board/table; search; **Chat “create WO” confirmation flow** | — |
| Search | Company factory **full-text** global search + requirement FTS; **Vector** semantic search (`?mode=semantic`) | — |
| Issues bridge | `linked_issue_id` + Track / Open linked | — |
| Canvas | Factory card nodes + PLC graph layer + **PLC stage WO rollup** on `stage` nodes; **Mermaid** diagram nodes; **Vault** canvas topology sync | — |
| Chat / RAG | Project-scoped threads + artifact RAG; org-level docs in RAG; `?prompt=` pre-fill + auto-send; clickable prompts in `FactoryAssistPanel`; Ask employee picker; WO creation from chat | Citations UX (done); Ask runner (done); embedded copilot thread (done) |
| Agents / MCP | REST for authenticated clients; **MCP package** (`packages/mcp` — stdio server with WO tools); **Design Engineer** binding (`software_factory_lead_agent_id` on `projects`, "Ask Design Engineer" in factory Configuration); **Blueprint Generator** and **Validation Fixer** instruction sets in `doc/software-factory-agents.md` | Debater agent |

**Conclusion:** Phase **2 MVP** for the Software Design Factory is **closed** in Hypowork for human-led iteration. Unchecked bullets below remain **optional stretch** unless you promote them for a specific release.

---

## Phase 2 done when (full vision)

- You or a designated Paperclip agent can run: requirements → blueprints → work orders → agent execution → validation; all with project plan, diagrams, and notes in one place.
- Project canvas shows **diagrams** as nodes and documents connected by edges; chat in project scope with **rich citations** and optional agent runners (Design Engineer, MCP).

**MVP interim bar (met):** A human team can run the same pipeline with REST + UI, linked issues, Gantt visibility, and DnD Kanban — without vector search or first-class agent automation.

**Next:** [phase-3.md](phase-3.md) — Hardware Design Factory.
