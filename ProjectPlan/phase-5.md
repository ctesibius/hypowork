# Phase 5 — Zero-Human Runway

**Goal:** CEO Agent + Research Director + pods run with minimal founder intervention; you monitor via Note Viewer and step in only for exceptions.

**Phase 6 note:** [phase-6.md](phase-6.md) (Chat-Native Knowledge + 6R Automation) runs underneath Phase 5 — the CEO/Research Director and pods use Phase 6's chat-as-editor interface to manage knowledge. They are not separate sequential phases; Phase 6 is the knowledge layer that Phase 5 agents operate through.

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Phase 5)

---

## Hypowork implementation status (living — 2026-03-25)

**Shipped:**
- **Heartbeat wake context** — `issueId`, `taskKey`, `wakeReason` all propagate correctly through `agent_wakeup_requests` to adapter executors. Wakeup coalescing, idempotency, and `runId` tracking all in place.
- **Budget infrastructure** — `budgetService` fully implemented: `upsertPolicy`, `evaluateCostEvent`, `getInvocationBlock`, `resolveIncident`; soft/hard threshold detection; `budget_policies` + `budget_incidents` tables; `cancelWorkForScope` hook wired to heartbeat. Active in cost ingestion and heartbeat dispatch.
- **Audit log** — `activity` table + API + ActivityRow UI covers Phase 1–4 scope (mutations, agent lifecycle, approvals, budget events).
- **NotesViewer** — `getProjectMilestones()` queries closed `issues` by project; `getExperimentHistory()` delegates to `LearnerService.listExperiments`. Both wired 2026-03-25.
- **Pods schema** (2026-03-25) — `pods` table with `id`, `companyId`, `name`, `kind`, `leadAgentId`, `status`, `pauseReason`, `pausedAt`, `lastActiveAt`; `podsService` with create/list/updateLead/setStatus/addAgent/removeAgent; agent membership stored as `role = 'pod:{podId}'` on the `agents` table.
- **Pod budget scope** (2026-03-25) — `scopeType: "pod"` added to `BUDGET_SCOPE_TYPES`; `budgetService` extended: `resolveScopeRecord` (pod), `computeObservedAmount` (sums costs for all agents in pod), `pauseScopeForBudget`/`resumeScopeFromBudget` (pod), `evaluateCostEvent` (pod relevance), `getInvocationBlock` (pod hard-stop check); `cancelBudgetScopeWork` cancels all pod agent runs on budget exceeded.
- **CEO agent adapter** (2026-03-25) — `adapterType: "ceo"` in `server/adapters/ceo/`; reads company budget/pod/issue state from DB; configured via `heartbeat.intervalSec` for scheduling; `checkBudgetStatus`, `checkPodHealth`, `checkGoalProgress` config flags; outputs structured report to run log.

**Plan shipped (2026-03-25):**
- `doc/plans/2026-02-19-ceo-agent-creation-and-hiring.md` — fully implemented: `pending_approval` status, `can_create_agents` permission, `assertCanCreateAgentsForCompany` / `canCreateAgents` helpers, `PATCH /agents/:id/permissions`, `GET /agents/:id/configuration`, `GET /companies/:companyId/agent-configurations`, approval `requestRevision` / `resubmit`, activity logging for all permission changes.

**Not done yet:**
- CEO Agent wired to heartbeat scheduler with `adapterType: "ceo"` and `intervalSec > 0`; needs a `hire` call to create the CEO agent with the right config (once the agent is hired with CEO role, the heartbeat scheduler fires it on the configured interval). Infrastructure is ready; instantiation is the remaining step.
- Audit log extension for Phase 5 governance events: podsService now logs `pod.created`, `pod.lead_updated`, `pod.status_changed`, `pod.agent_added`, `pod.agent_removed`, `pod.deleted` — experiment outcomes still missing (LearnerService is in-memory NestJS, not persisted; would need DB-backed experiment table first).
- CEO → Research Director → pod spawn chain (CEO creates pod leads; Research Director role not yet separated).
- Per-pod isolated runtimes (git worktree/container) — not started.

---

## 5.1 CEO Agent

- [ ] CEO Agent (or equivalent) owns vision and projects; sets missions and budgets from high-level prompts or scheduled review.
- [ ] Can create/update goals and assign to Research Director or pods.

## 5.2 Research Director

- [ ] Spawns and monitors specialized pods (Design Engineer, Project Engineer, Learner, Factory Runners).
- [ ] Reads Vault + Mem0 to decide next missions or reallocation.
- [ ] Reports to CEO (or dashboard); no human required in loop for routine spawn/monitor.

## 5.3 Pod autonomy

- [ ] Design Engineer Pods: Autoresearch-style loop on design artifacts; results → Mem0 + Vault.
- [ ] Project Engineer Pods: lifecycle docs (CDR/TRR/MRR); same memory sync.
- [ ] Factory Runner Pods: drive Software or Hardware Factory from work orders; notes and plan in Vault.
- [ ] All pods: isolated runtime (git worktree/container), Mem0 for personal memory, Vault for shared.

## 5.4 Founder layer only for exceptions

- [ ] Note Viewer: live search, rendered notes, milestones, experiment history — read-only for founder.
- [ ] **Founder chat as primary interface:** One place to “chat to notes,” “ask any employee,” and ask in project scope (Software/Hardware Factory). All Phase 1–4 chat capabilities unified; optional “natural language command” to create goal, assign agent, or request report (with confirmation). Unified context may include **company document neighborhoods** ([hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md)) alongside Vault/Mem0.
- [ ] **Canvas as spatial control room (optional):** Company canvas + per-project Factory canvases; all documents, diagrams, notes with edges; zoom to project or artifact; open from canvas into chat or Note Viewer.
- [ ] Alerts or dashboard for anomalies (e.g. budget breach, repeated failures); human steps in only then.
- [ ] Optional: approval gates for high-impact actions (e.g. deploy, spend above threshold); rest is autonomous.

---

## Phase 5 done when

**Infrastructure shipped (2026-03-25):**
- Pods schema + service + routes — pods can be created, agents assigned, budgets enforced
- Pod budget scope — pod hard-stops pause all pod agents; CEO adapter reports pod health
- CEO agent plan fully implemented — pending_approval, permissions, hire flow, revision/resubmit

**Requires operational instantiation:**
- Hire CEO agent: `POST /api/companies/:COMPANY_ID/agents` with `{ role: "ceo", adapterType: "ceo", runtimeConfig: { heartbeat: { intervalSec: 3600 } } }`
- Once CEO is hired + interval set, heartbeat scheduler auto-fires it on the configured schedule
- CEO → pod spawn chain: CEO calls `POST /api/companies/:id/agents` to create pod leads (permission-gated)

After CEO hire + Phase 6 chat-as-editor: system executes with zero human in the loop for routine operations.

**Next:** After Phase 5+6, the full system is self-building with zero human in the loop. The founder monitors via Note Viewer, chat, and alerts.

**End of phase roadmap.** Use [MASTER_PLAN.md](MASTER_PLAN.md) for full context and checklist summary.
