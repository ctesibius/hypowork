# Phase 3 — Hardware Design Factory

**Goal:** Same Refinery → Foundry → Planner → Validator flow for mechanical + PCB; iterate, plan, design, diagram, notes. See [designfactory.md](designfactory.md) for full spec.

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Phase 3)

**IA alignment with Phase 2:** Same project shell tab **Design Factory** (exact label). Inside: **Refinery → Foundry → Planner → Validator** — only artifact types and integrations differ (CAD, schematic, BOM vs code). Same distinction: **Planner work orders** ≠ **Issues**; optional **Track on Issues** link when board visibility is needed. Same **factory_template** / `project_kind` idea: hardware projects load the hardware factory module behind the same tab.

---

## 3.1 Core platform

- [ ] “Hardware Factory” app or module: same four modules, tuned for HDLC (requirements, CAD, BOM, fab, sim).
- [ ] Auth, project CRUD; one project = one hardware product (e.g. drone frame + flight controller).
- [ ] **Design Factory** tab reuses Phase 2 shell; template `hardware` (or `hybrid`) wires APIs/UI to hardware artifacts (mechanical + electrical in one project when it is one product).

## 3.2 Refinery (hardware requirements)

- [ ] Requirements: functional specs, mechanical constraints, electrical, compliance.
- [ ] Versioning and semantic search; optional requirements debater agent.

## 3.3 Foundry (blueprints + early CAD)

- [ ] System blueprints: block diagrams, early CAD concepts.
- [ ] Onshape (or equivalent) integration: create document via API, link to project.
- [ ] Optional: KiCad/Altium link for schematics; BOM sync.

## 3.4 Planner v2 (work orders + Gantt)

- [ ] Work orders: e.g. “Generate PCB layout”, “Run FEA”, “Order prototype PCBs”.
- [ ] Gantt for long-lead (fab/assembly); Kanban; dependency mapping (e.g. PCB before mechanical).
- [ ] MCP-style tools for hardware agents: Onshape, KiCad, Octopart/Digi-Key, JLCPCB quote APIs.
- [ ] Global search across requirements, CAD metadata, BOMs, sim reports.

## 3.5 Validator (sim + DFM + feedback)

- [ ] Ingest simulation results, prototype test data, field feedback.
- [ ] Auto-generate fix orders (e.g. tolerance issue → update drawing).
- [ ] Optional: bananaz-style or custom DFM/GD&T checks.

## 3.6 Integration with Phase 1

- [ ] Paperclip “Hardware Factory Runner” agent drives Hardware Factory flow; notes and project plan in shared vault.

## 3.7 Chat (Phase 3) — Hardware Factory scope

- [ ] **Project-scoped chat for hardware:** RAG includes requirements, blueprints, CAD metadata, BOMs, work orders, sim/validation results.
- [ ] Optional: same **company doc graph / neighborhood** as Phase 1 ([hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md)) when hardware projects link to org notes.
- [ ] **Chat about design and BOM:** e.g. “What’s the current BOM for the drone frame?”; answers with citations.
- [ ] **Ask Hardware Factory Runner:** Query that agent’s knowledge (Mem0 + Vault) for the project; citations to notes and artifacts.
- [ ] Optional: From chat, create work order (e.g. “Run FEA on bracket”) with confirmation; appears in Planner.

## 3.8 Infinite canvas (Phase 3) — Hardware Factory

**Reuse:** Same **Phase 1 canvas engine** ([phase-1.md](phase-1.md) §1.7) extended with **hardware** node types and templates.

- [ ] **Project canvas for hardware:** Nodes = requirements, blueprints, BOM references, work orders, CAD/schematic links, notes.
- [ ] **Diagrams and whiteboard:** Block diagrams, enclosure sketches, or embedded diagrams as nodes; connectors (e.g. requirement → blueprint → “PCB layout” work order).
- [ ] **PDR → CDR → TRR:** Lifecycle docs as nodes with edges; same workflow as software.
- [ ] **Sync to Vault:** Canvas structure and refs available to agents and chat; optional shared graph view across software + hardware projects.

---

## Phase 3 done when

- You or a designated agent can run full HDLC in-app: requirements → blueprints → work orders → agent-driven CAD/BOM/sim → validation; notes and diagrams tracked.
- Hardware project canvas shows docs and diagrams with edges; chat in hardware scope with citations.

**Next:** [phase-4.md](phase-4.md) — Self-Improvement.
