# Phase 4 — Self-Improvement (Less Human Intervention)

**Goal:** The system improves itself — learner agents tune skills/prompts/config; outcomes feed back into company memory; fewer manual fixes.

**Reference:** [MASTER_PLAN.md](MASTER_PLAN.md) (Phase 4)

---

## Hypowork implementation status (living — 2026-03-24)

**Shipped in app (partial Phase 4):**

- **`PromptLearningService`** — `task_outcomes` + `message_ratings` recording; `getPromptMetrics`; `promotePromptVersion` (baseline swap, computes `improvementOverParent` from parent); `createCandidate` scaffold for mutation pipeline. HTTP: `/api/companies/:companyId/task-outcomes`, `…/messages/:id/rate`, `…/prompt-versions/:id/metrics`, `…/prompt-versions/:id/promote`, `POST …/prompt-versions` (see [testreport.md](testreport.md)).
- **`LearnerService`** — in-memory experiments; mock metric evaluation; on **keep**, writes Mem0 + **Vault** lesson; calls `recordExperimentOutcome` for dual-loop data.
- **Vault** — `create6RLog`, `run6RCycle` APIs (manual/synchronous; not a full scheduled reflect loop).
- **`promptVersionId` attribution** — both instance **chat** and **editor copilot** attach `promptVersionId` to assistant messages when the company has a `hypowork-default` row in `prompt_versions`; omitted when no row exists. This is the DB-backed version of the Phase 1 foundation.
- **Composite scoring** — `computeCompositeScore` + `getPromptMetrics` use spec weights (0.6 human + 0.3 success + 0.1 efficiency), time-decay weighting (7-day window, 2× recency), and `MIN_SAMPLE_SIZE = 20` guard; return `confidence: "low" | "high"` and `improvementOverParent` when a parent exists.

**Not done yet — moved to [phase-6.md](phase-6.md):**

The items below require chat-as-editor capabilities (chat creates/updates notes, manages wikilinks, triggers 6R cycles) and are deferred to **Phase 6** where that interaction model is designed and built.

- **Mutation harness + pattern extraction** — `createCandidate` scaffold exists; full `runPromptEval` suite, LLM-assisted mutation, and LLM analysis of ≥4-star / ≤2-star responses into Vault claims / 6R logs.
- **Scheduled 6R / reflect loop** — `run6RCycle` is synchronous/manual; needs chat trigger + scheduled job + Vault writeback.
- **Wikilink graph via chat** — 6R outputs, learner lessons, and reflect/reweave results written as notes with `[[wikilink]]` edges; chat can query and update the graph.
- **Budget / audit dashboard** per §4.4 (deferred; depends on budget tracking being wired into chat context).

**Manual tests:** [testreport.md](testreport.md) § Phase 4.

---

## 4.1 Learner improves artifacts

- [ ] Learner agent can target artifacts beyond `train.py`: e.g. skill markdown (SKILL.md), prompts, or Factory config.
- [ ] Metric: e.g. task completion rate, reweave quality, or project milestone velocity.
- [ ] Improved artifacts (skills, prompts) used by other agents on next heartbeats; no manual copy-paste.

### 4.1.1 Dual-Loop Prompt Evolution (Phase 1 Foundation → Phase 4 Completion)

**Prerequisites (Phase 1):** `message_ratings` table, `task_outcomes` table, `prompt_version_id` tracking on messages.

**What this adds:** Full closed-loop learning — automated signals + human feedback → prompt candidates → keep/discard → institutional memory.

#### Prompt Versions (Versioned, Lineage-Tracked)

- [ ] **Prompt versions table:** `prompt_versions` — `id`, `company_id`, `skill_name` (e.g. 'general', 'react-expert', 'nestjs-expert'), `version` (integer), `content` (text), `parent_id` (FK to `prompt_versions.id`, nullable — for lineage), `status` ('baseline' | 'candidate' | 'promoted' | 'rejected'), `metrics` (jsonb: `{ avg_rating, response_count, improvement_over_parent }`), `created_at`, `evaluated_at`.
- [ ] **Current baseline:** Each skill has one `status = 'baseline'` prompt used for inference; candidates inherit from baseline.
- [ ] **Lineage tracking:** `parent_id` creates a tree — we can trace which prompt version led to which improvement.

#### Evolution Engine

- [ ] **PromptLearningService:** New service (or extend `LearnerService`) with:
  - `createCandidate(parentId, mutation)` — mutate prompt (structural, instruction, examples, constraints)
  - `runPromptEval(candidateId, testCases)` — run against evaluation set
  - `decide(promptId)` — keep/discard based on composite score
  - `promotePrompt(promptId)` — set as new baseline for skill
  - `revertToParent(promptId)` — discard regression

#### Composite Scoring (Weighted Dual Signals)

- [ ] **Automated signal weight:** 0.3 (task success rate from `task_outcomes`)
- [ ] **Human feedback weight:** 0.6 (avg rating from `message_ratings`)
- [ ] **Efficiency weight:** 0.1 (budget/speed from `task_outcomes`)
- [ ] **Minimum sample size:** 20 interactions before making promote/reject decision
- [ ] **Statistical significance:** Require `delta > 0.2` improvement over parent + enough sample volume

#### Mutation Strategies (How Candidates Are Generated)

- [ ] **Structural mutations:** Add/remove/reorder sections ("Context", "Guidelines", "Examples")
- [ ] **Instruction mutations:** Reword role definitions ("You are an expert" → "Act as senior staff engineer")
- [ ] **Example mutations:** Fiddle few-shot examples; swap in higher-rated response examples
- [ ] **Constraint mutations:** Tighten/loosen output format requirements
- [ ] **LLM-assisted mutation:** Use an LLM to propose changes based on pattern analysis from winning responses

#### Pattern Extraction (The "Learning" Part)

- [ ] **Analyze high-rated responses:** For each prompt version, find messages with rating ≥ 4; ask LLM: "What patterns do these responses share?"
- [ ] **Extract winning patterns:** Structural, tone, content patterns → stored as claims in Vault
- [ ] **Anti-patterns:** Low-rated responses (rating ≤ 2) → stored as 6R-logs (Reject, Revise) in Vault
- [ ] **Seed next mutations:** Use extracted patterns to guide candidate generation

## 4.2 Synthesis into company memory

- [ ] When learner keeps an experiment: auto-write “lesson” or “best config” into the Vault (shared) via knowledge skill; per-agent takeaways can go to Mem0.
- [ ] Other agents (and Note Viewer) see these lessons; new pods get better default context.

## 4.3 6R / reflect loop automated

- [ ] Post-iteration or scheduled job: reflect on recent work (experiments, closed issues, Factory outcomes) → reweave → verify; results in Vault.
- [ ] Optional: Research Director (or meta-agent) reads vault and suggests new missions or pod config changes.

### 4.3.1 Dual Signal Aggregation

**Why:** Both automated (task outcomes) and human (ratings) signals feed into the same decision — need unified aggregation.

- [ ] **Unified metrics view:** `PromptLearningService.getAggregatedMetrics(promptVersionId)` returns:
  ```typescript
  {
    humanFeedbackScore: number;      // avg rating (1–5)
    automatedSuccessRate: number;    // success / total from task_outcomes
    efficiencyScore: number;         // 1 / (1 + normalized_budget)
    compositeScore: number;           // weighted: 0.6*human + 0.3*success + 0.1*efficiency
    sampleSize: number;              // total interactions
    lastUpdated: Date;
  }
  ```
- [ ] **Time-decay weighting:** Recent signals weighted more heavily — e.g., ratings from last 7 days count 2x vs older.
- [ ] **Confidence indicator:** Show "low confidence" (< 20 samples) vs "high confidence" (> 100 samples) on prompt cards.

## 4.4 Budgets and governance

- [ ] Per-agent (and per-pod) budgets in Paperclip; heartbeat frequency caps to avoid unbounded cost.
- [ ] Audit log: who (which agent) did what, when; visible in dashboard.

## 4.5 Chat (Phase 4) — lessons and reflection

- [ ] **Chat about lessons learned:** RAG over Vault includes 6R outputs, learner “lessons,” and reflect/reweave results; “What did we learn about X?” with citations.
- [ ] **Ask learner / Research Director:** Query agent knowledge for experiment history, suggested next missions, or pod config; answers cite Mem0 + Vault.
- [ ] Optional: “Suggest improvement” from chat: user asks for recommendation; system (or meta-agent) proposes skill/prompt change; user approves before write to Vault.

---

## Phase 4 done when

- ✅ Learner agents improve skills/config; outcomes and lessons flow into vault.
- ✅ Dual-loop prompt evolution scaffold (composite scoring, lineage, createCandidate).
- ✅ You only set budgets and approve high-level direction.

**Deferred to [phase-6.md](phase-6.md):** Mutation harness + pattern extraction; scheduled 6R; wikilink graph via chat; budget dashboard.

**Next:** [phase-5.md](phase-5.md) — Zero-Human Runway (can run in parallel with Phase 6).
