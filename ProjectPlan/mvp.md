# MVP — Use from day one (on Nest)

**Goal:** Ship the smallest slice that delivers value: company/department, AI + human employees, board (goals/projects/issues), notes/plans. Build on the Nest server from [phase-0.md](phase-0.md).

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Phase 0 — MVP section, Vision Summary)

---

## Prerequisites

- ✅ Phase 0 complete: Nest server with Paperclip API parity, heartbeat, auth.

---

## Checklist

### Org and auth

- [x] Paperclip control plane running on Nest: company/department, org chart, goals/projects/issues scaffolding.
- [x] Company or department maps 1:1 to Paperclip company/workspace.
- [x] Auth for human employees (JWT + RBAC or Better Auth); invited humans can sign in and write notes / complete issues.
- [ ] Optional: SSO later without changing task/issue model.

### Employees: AI and human

- [x] **Hire AI agent:** Owner adds AI agent (role + adapter); agent on org chart.
- [x] **Invite user (human):** Owner invites user; they sign in and join org; same roster as AI employees.
- [x] **Assignment:** Any employee (human or AI) can be assigned an issue; AI via heartbeat + adapter, humans via UI.
- [ ] **Org directory (MVP+):** Org page shows **AI agents** + **human members** (`/members`); richer human names/emails can follow ([`docs/plans/org-directory-employees-and-restore.md`](../docs/plans/org-directory-employees-and-restore.md)).
- [ ] **Restore terminated agents:** Board can reactivate `terminated` → `idle` (PATCH + `restoreFromTerminated`); optional `GET .../agents?includeTerminated=true` (board-only) for directory — see same plan doc.

### Board: goals, projects, issues

- [x] **Goals:** create/list goals; link to projects.
- [x] **Projects:** create projects under a goal or standalone.
- [x] **Issues (tasks):** create issues under projects; assign to human or AI employee.
- [x] **Heartbeat (for AI):** At least one Run trigger (on-demand ok) so assigned AI issues execute via adapter + agent runtime.

### Notes and plans

- [x] **Shared notes:** Minimal markdown docs (notes/plans) visible to org members. (Documents module added to Nest API)
- [x] **Graph view (MVP — prioritize early):** Documents already exist; a **library graph** (how notes link to each other) is **foundational** for navigation and matches the Hypopedia mental model — **ship before** treating MVP as “documents complete.”
  - [x] **Link index:** Obsidian-style `[[wikilink]]` and `@` references between **company documents**, materialized **outlinks/inlinks** (e.g. `document_links`); **1-hop neighborhood** API (or equivalent) to feed the graph and later chat/RAG — see [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md) **Track DG**.
  - [x] **Graph UI (v1):** Route `/documents/graph`: **nodes = documents**, **edges = resolved links**; click opens the doc. **MVP** uses workspace `@hypowork/doc-graph-3d` (`3d-force-graph` npm) with **selectable view presets** mapped from `3d-force-graph-master/example/*`; choice stored in `localStorage` (`hypowork:documentsGraph:viewPreset`). **Phase 1 §1.9** continues Hypopedia-class hardening. See [phase-1.md](phase-1.md) §1.9.
- [x] **Plans:** Create/edit "project plan" docs; link to projects/issues (lightweight relationship ok for MVP).
- [x] **Linking:** Optional link note → project/issue so UI can jump from board to doc.

### Optional: simple canvas (per document)

**Model (Hypopedia-style):** Company **documents** are one primitive: each item has a **kind** (or **mode**) — **Document** (prose: markdown / rich text) or **Canvas** (spatial board). Same list, permissions, and routes; opening the item chooses the right editor.

- [x] **Kind + storage:** API and UI support creating/opening a doc as **prose** vs **canvas**; canvas state persisted (e.g. JSON graph: nodes + optional edges) alongside or instead of markdown body for that row.
- [x] **Canvas MVP (simple):** For **canvas** kind only — **cards** (title + optional link to note/project/issue); **optional connector** between two cards (edge). Fixed or bounded viewport ok; **no** full infinite plane, tool palette, or presentation/view mode yet (Phase 1).
- [x] **UX:** Document list shows kind; user can create “New canvas” or switch kind where product allows.

*Note:* If the shipped app still exposes a **single org-wide** canvas, treat that as a stepping stone; converge on **per-document** canvas as the target shape above.

---

## MVP done when

A user can create a company/department, hire AI agents and/or invite humans, create goals/projects/issues, write notes and plans, assign issues to humans or agents, and see AI execution complete via heartbeat.

**Documents:** Members can **browse the company library as a link graph** at `/documents/graph` (API `GET .../documents/graph`, `document_links` + neighborhood for RAG). **3D** presets are exploratory; tighten **Hypopedia-class** behavior in **Phase 1 §1.9** ([§ Notes and plans — Graph view](#notes-and-plans)).

**Next:** [phase-1.md](phase-1.md) — Memory, chat, canvas, learner.
