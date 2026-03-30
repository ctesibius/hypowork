# Phase 6 — Chat-Native Knowledge + 6R Automation

**Goal:** Chat is the primary interface for reading and writing company knowledge. The 6R reflect loop, learner lessons, and pattern extraction all create, update, and link notes — accessible and triggerable from chat.

**Why this is Phase 6:** The Phase 4 "scheduled 6R" and "pattern extraction" items need chat to create/update notes with wikilinks. The mutation harness needs the same. Building chat-as-editor first makes those three features coherent rather than three separate integrations.

---

## 6.1 Chat-as-editor interaction model

### What "chat edits notes" means in practice

Chat can act on behalf of the user to create and modify company documents. The key interactions:

| Interaction | What happens | Example in chat |
|---|---|---|
| **Read + summarize** | Chat retrieves note(s), answers question | *"What did we decide about the auth flow?"* |
| **Create note** | Chat creates a new note in Vault, optionally with wikilinks | *"Create a note summarizing our API error handling approach"* |
| **Update note** | Chat edits an existing note's content | *"Add a section on rate limiting to our API design note"* |
| **Link notes** | Chat adds `[[wikilink]]` edges between related notes | *"Link this note to the auth decisions doc"* |
| **Trigger 6R** | Chat (or schedule) runs reflect/reweave cycle, results written as notes | *"Run a 6R reflect on our last sprint"* |
| **Query graph** | Chat traverses wikilink neighborhoods for context | *"Show me all notes linked to the onboarding project"* |

### Design constraints

- Chat **never edits source code directly** — only notes, wikilinks, and structured metadata.
- All edits go through the **Vault API** (or document service); chat does not bypass the storage layer.
- Wikilinks use the existing `[[note title]]` or `[[note id]]` format already defined in [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md).
- Edit actions are **confirmed** before writing (unless user has opted into fully autonomous mode).

### UI: edit-in-chat vs. edit-in-editor

| Mode | When it fires | User experience |
|---|---|---|
| **Suggestion mode** | AI proposes an edit | Chat shows diff; user approves or edits |
| **Auto-write mode** | User enabled in settings | Chat writes directly; shows a toast confirmation |
| **Manual mode** | User triggers from chat | Chat opens a note editor panel; user edits manually |

---

## 6.2 Wikilink graph via chat

### Storage

- `[[wikilink]]` syntax stored in note `content` as plain text.
- A `note_links` table (or equivalent index) tracks `(source_id, target_id, link_text)` for efficient graph traversal — not parsed from content at read time.
- `VaultService` exposes `linkNotes(sourceId, targetId, linkText?)` and `getLinkedNotes(noteId, depth?)`.

### Chat graph interactions

- **Context injection:** When chat retrieves notes for RAG, it also fetches the note's linked neighborhood (depth=1 by default) so the AI sees related context without extra round-trips.
- **Link suggestion:** When chat writes a new note, it can suggest `[[wikilink]]` additions to recently retrieved notes (based on shared topics or explicit mention).
- **Graph queries from chat:** `"What notes are linked to the payment integration spec?"` → walks `note_links` → returns a list with snippets.

### Wikilink creation from 6R outputs

When the 6R cycle runs (see §6.3), it creates notes that link back to:
- The source claim or decision that triggered the cycle
- Related experiment summaries (for learner lessons)
- Parent/child notes in the same 6R chain

This builds a navigable graph of company knowledge over time.

---

## 6.3 6R / reflect loop — automated with chat trigger

### Trigger modes

| Mode | How triggered | Writes to |
|---|---|---|
| **Chat trigger** | User: *"Run 6R on the auth service decisions"* | New note with chain wikilinks |
| **Scheduled** | Cron job (daily or per-sprint) | New note with chain wikilinks |
| **Event** | Issue closed, experiment completed | New note with chain wikilinks |

### 6R pipeline steps

For each candidate claim or decision note:

1. **Reduce** — Summarize: what is the core claim? Store as a Vault note.
2. **Reflect** — Challenge: what could be wrong? Store as a separate Vault note, linked.
3. **Reweave** — Integrate: how does this connect to existing knowledge? Update or create linked notes.
4. **Verify** — Check: does the reweave hold? Write a verification note with status.
5. **Rethink** — Meta: what should we do differently? Write a rethink note with action items.

Each step creates or updates at least one Vault note with `[[wikilink]]` edges to the source and other steps in the chain.

### Output notes

The 6R cycle produces:
- A **chain note** summarizing the full cycle and its outcome
- Per-step notes linked with `[[next:step_name]]` wikilinks
- Tags: `6r`, `reflect`, `cycle:{id}`, `phase:{reduce|reflect|reweave|verify|rethink}`

---

## 6.4 Mutation harness + pattern extraction (Phase 4 carryover)

### Mutation harness

The `createCandidate` scaffold (already shipped in Phase 4) accepts mutated prompt content. The harness wires it to:

- **Eval suite** — `runPromptEval(candidateId, testCases)` runs a set of prompt-input/expected-output pairs and scores the candidate. Test cases come from high-rated historical messages (rating ≥ 4).
- **LLM-assisted mutation** — Given a baseline prompt and eval results, an LLM proposes structural/instruction/examples/constraints mutations. `createCandidate` is called with the result.

### Pattern extraction

After each 6R cycle and learner experiment completion:

- Find messages with rating ≥ 4 → LLM: *"What patterns do these responses share?"* → store as a **Vault claim** (`type: claim`, `domain: prompt_patterns`).
- Find messages with rating ≤ 2 → LLM: *"What went wrong?"* → store as a **6R log** (`phase: reduce`, `type: 6r_log`).

These patterns feed the mutation harness: high-rated pattern descriptions become mutation guidance for the next candidate.

---

## 6.5 Budget / audit dashboard (Phase 4 carryover)

### Budget tracking

- Each agent pod has a `budgetLimitCents` and `heartbeatFrequencyMaxHz` in its config.
- `TaskOutcome.budgetUsedCents` accumulates per agent per period.
- Dashboard shows: budget spent vs. limit, trend over time, anomalous spikes.

### Audit log

- Every mutating action (note create/update/delete, wikilink add/remove, 6R cycle run, prompt promote) is logged to an `audit_log` table.
- Log entry: `{ actor, action, resource, timestamp, metadata }`. Actors can be human users or agent IDs.
- Chat can query: *"What did the learner agent change last week?"*

---

## 6.6 Chat Phase 6 — unified knowledge interface

### Capabilities (extends Phase 1 / Phase 4 chat)

- **"What did we learn about X?"** — RAG over Vault claims, 6R logs, and learner lessons; answers cite sources.
- **"Run 6R on [note]"]** — triggers the reflect loop from chat; reports back with a link to the new chain note.
- **"Create a note that [[wikilinks]] to [X] and [Y]"** — creates the note and establishes the links.
- **"Show me the knowledge graph around [note]"]** — returns linked notes with snippets.
- **"Suggest improvements to our [skill name] prompt"** — runs mutation harness, returns candidate with diff.
- **"What changed in the audit log?"** — returns recent audit entries filtered by actor or action type.

### Founder monitor

Founder can:
- Query any of the above
- Enable/disable auto-write mode
- Set budget thresholds
- Approve/reject high-impact mutations before they promote

---

## Phase 6 done when

- Chat can read notes, create notes, update notes, and add wikilinks via natural language.
- 6R cycle can be triggered from chat or schedule; results are linked notes in Vault.
- Pattern extraction runs after 6R and experiment completion; claims appear in Vault.
- Mutation harness accepts LLM-proposed candidates; eval suite scores them; winners can be promoted.
- Audit log captures all mutating actions; chat can query it.
- Budget dashboard shows per-pod spend; alerts fire on threshold breach.

**Next:** After Phase 6, the system is fully self-improving and chat-native. Phase 5 (zero-human runway) runs underneath — CEO/Research Director use the Phase 6 chat interface to coordinate, and the 6R loop + pattern extraction run without human trigger.
