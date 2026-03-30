# Plate autosave investigation report

## Date: 2026-03-21

## Summary

Compared **plate-main** demos, **hypowork** server documents, **arscontexta-grok** (Plate + local vault + tab collab), and **Hypopedia** (BlockSuite / AFFiNE-style **Yjs** + **nbstore**). The latter two lean on **CRDTs** so concurrent editing merges instead of last-write-wins; hypowork uses **revision-based** conflict detection on markdown PATCH.

**Roadmap:** Hypowork engineering for **scale**, **wikilink/`@` graph**, and **Mem0/Vault neighborhood** is tracked in [hypowork-documents-scale-and-graph.md](hypowork-documents-scale-and-graph.md) (ProjectPlan).

---

## A. `plate-main/apps` — three patterns

### 1. Simple localStorage

**Location:** `plate-main/apps/www/src/registry/examples/installation-next-04-value-demo.tsx`

- Load initial value from `localStorage` in `usePlateEditor({ value: () => ... })`.
- Persist on every `<Plate onChange>`.

### 2. Debounced localStorage

**Location:** `plate-main/apps/vite-markdown` (e.g. `src/lib/debounce.ts` + `App.tsx`)

- Same idea as (1), but **debounce** writes (~500ms) to avoid thrashing `localStorage` on every keystroke.

### 3. Collaborative (Yjs)

**Location:** `plate-main/apps/www/src/registry/examples/collaboration-demo.tsx`

- Real-time sync via `@platejs/yjs` (WebRTC / WebSocket), not a classic “debounced save to disk.”

| Pattern       | File / area                       | Storage / transport |
| ------------- | --------------------------------- | ------------------- |
| Simple        | `installation-next-04-value-demo` | localStorage        |
| Debounced     | `vite-markdown`                   | localStorage        |
| Collaborative | `collaboration-demo.tsx`          | Yjs                 |

---

## B. `hypowork` — standalone document autosave

**Primary surface:** `hypowork/client/src/pages/DocumentDetail.tsx`

### Flow

1. **State:** `title` and `body` (markdown string) mirror the server document; Plate emits markdown through `PlateFullKitMarkdownDocumentEditor` → `onMarkdownChange`.
2. **Debounce:** After **2s** without further title/body changes (`AUTOSAVE_MS`), a timer fires and calls `commitSave()`.
3. **API:** `documentsApi.update` → `PATCH /companies/:companyId/documents/:documentId` with `{ title, format: "markdown", body, baseRevisionId }` — **optimistic concurrency** on `baseRevisionId` (latest revision from the loaded doc).
4. **UI:** `useAutosaveIndicator` drives breadcrumb text (“Saving…”, “Saved”, “Save failed”): brief delay before showing “Saving…”, then “Saved” lingers ~1.6s before returning to idle.
5. **Navigation:** `useBlocker` + `beforeunload` while dirty, while a save is in flight, or while a debounced save is **still scheduled** (`pendingAutosave`). Leave dialog offers Save / Discard / Stay; discard has a short cooldown.
6. **Conflicts:** HTTP **409** shows a banner; user can reload to pull server markdown and bump a `reloadNonce` to remount the editor.
7. **Plate hydration:** For large docs, early tiny serializations vs. a server baseline are ignored until hydration is considered complete (`baselineBodyRef`, `plateHydratedRef`) so autosave does not fire on spurious partial markdown.

### Shared hook

**`hypowork/client/src/hooks/useAutosaveIndicator.ts`** — reusable `idle | saving | saved | error` with `markDirty`, `reset`, `runSave(saveFn)`.

**Related (same idea, different screens):** `IssueDocumentsSection.tsx` (~900ms debounce per issue document draft), `InlineEditor.tsx` (~900ms).

---

## C. `arscontexta-grok` — Plate notes, vault write, same-tab collaboration

**Paths:** `/Users/bnguyen/Desktop/Github/arscontexta-grok/frontend/src/components/NoteEditor.tsx`, `.../editor/PlateNoteEditor.tsx`, `.../editor/packages/yjs/src/lib/providers/broadcastchannel-provider.ts`

### Collaboration

- **`PlateNoteEditor`:** When `path` is set, configures **`YjsPlugin`** with provider **`broadcastchannel`**, `roomName: path` (note path = room id).
- **`BroadcastChannelProviderWrapper`:** Syncs **Y.Doc** + awareness across **same-origin browser tabs** — no server; CRDT merges concurrent edits so peers are not continuously overwriting each other’s typing (contrast with naive “save whole file” races while editing).

### Autosave

- **`NoteEditor`:** `lodash/debounce` **1500ms** on markdown from the editor; calls **`vault.write(path, ...)`** with frontmatter via API.
- Autosave runs only while **`isEditing`**; **Ctrl/Cmd+S** flushes immediately. Read-only transitions can trigger an immediate write.

### Why it can feel “safe” for others

- Live state merges over **Yjs**; persistence is **debounced** full-note writes to the vault rather than per-keystroke PATCH. Other tabs see CRDT-merged content; file write frequency is bounded.

---

## D. `Hypopedia` — BlockSuite + Yjs `nbstore` (local + cloud)

**Repo:** `/Users/bnguyen/Desktop/Github/Hypopedia` (AFFiNE-derived stack).

### Model

- Pages are **`yjs` `Doc`** instances (BlockSuite), not a single markdown string in app state.
- **`@hypopedia/nbstore`** **`DocFrontend`** (`packages/common/nbstore/src/frontend/doc.ts`) connects each `YDoc` to **DocStorage** (IndexedDB / SQLite in `workspace-engine` `local.ts` / `cloud.ts`) and **DocSync** for remote peers.

### Autosave / persistence

- On each **`doc.on('update', ...)`** (excluding updates applied from storage), the frontend **schedules** a `save` job carrying the **Yjs update binary**.
- A **per-document job queue** processes **load → apply → save**; multiple pending saves for one doc are **merged** (`mergeUpdates`) then **`storage.pushDocUpdate`** — incremental CRDT persistence, not “rewrite entire markdown.”
- **UI doc status** (`docState$` / `state$`) is **throttled** at **1000ms** (leading + trailing) for `updating` / `syncing` / `synced` signals.

### Collaboration

- **Cloud** workspaces sync doc updates through the backend/sync path (Yjs binary over the wire); **local** workspaces still use the same Yjs + nbstore pipeline against local storage.
- Multiplayer semantics are **CRDT-first**: convergence without requiring a single global “markdown revision” token like hypowork’s `baseRevisionId`.

---

## E. Comparison

| Aspect | Plate (`plate-main`) | hypowork `DocumentDetail` | arscontexta-grok | Hypopedia |
| ------ | -------------------- | ------------------------- | ----------------- | --------- |
| **Editor** | Plate | Plate | Plate | BlockSuite |
| **Truth in memory** | Slate JSON / Plate value | Markdown string + title | Plate + **Yjs** (when `path` set) | **Yjs `Doc`** |
| **Persistence** | localStorage or demo provider | REST **PATCH** + `baseRevisionId` | **Vault API** (full file + FM) | **Yjs update blobs** → IDB/SQLite (+ cloud sync) |
| **Debouncing** | ~500ms (vite-markdown) | **2000ms** | **1500ms** (markdown write) | Queue batch / merge of Yjs updates; **1s** throttle on status streams |
| **Concurrent edit** | Yjs demo (WebRTC/WS) | **409** + reload | **BroadcastChannel Yjs** (tabs) + debounced file write | **Yjs + sync** (local/cloud) |
| **“Won’t clobber peers”** | Only if using Yjs (and aware of save races) | Server rejects stale revision | CRDT for live edit; vault write still single-winner if two processes write file | CRDT end-to-end for doc bytes |

---

## F. Recommendation

For a **minimal local note app** without a backend, prefer the **debounced localStorage** pattern from `vite-markdown`:

1. Load value on mount via `usePlateEditor({ value: () => loadFromStorage() })`.
2. Save on change via `<Plate onChange={({ value }) => debouncedSave(value)}>`.
3. Use ~500ms debounce to limit writes.

For **hypowork / Paperclip-style documents**, follow **`DocumentDetail`**: debounced PATCH, `useAutosaveIndicator`, revision base, and navigation blocking — do not replace with localStorage-only persistence.

For **collaboration without constant overwrite of live typing**, prefer a **Yjs (or full nbstore) path**: **arscontexta-grok**-style BroadcastChannel for same-machine tabs, or **Hypopedia**-style **nbstore** when you need durable incremental sync and optional cloud multiplayer.
