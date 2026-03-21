# Plate feature parity: `hypowork` ↔ `plate-main/apps/vite-markdown`

**Purpose:** Close the gap between the **minimal** document editor (`PlateMarkdownDocumentEditor`) / **stub** `kits/editor-kit.tsx` and the **full** reference app in `plate-main/apps/vite-markdown`, using **`hypowork/packages/editor`** (fork of Plate) as the engine.

**Do you “need to do this request”?**  
Only if product goal is **near–feature parity** with the reference app (rich toolbar, slash, media, collaboration, etc.). For **Markdown-only** documents, many features need **explicit decisions** (what round-trips in MD, what is HTML-only or lossy). This plan splits **engine parity** vs **product-supported schema**.

---

## 1. Reference architecture (`plate-main`)

| Layer | Location | Role |
|--------|----------|------|
| **Plugin assembly** | `src/kits/editor-kit.tsx` | Composes ~30 kits: AI, blocks, code, table, media, math, comments, slash, DnD, markdown, docx, toolbars, … |
| **Copilot** | `src/plugins.tsx` | `plugins = [...CopilotKit, ...EditorKit]` |
| **App shell** | `src/App.tsx` | `Plate` + `EditorContainer` / `Editor` + optional TOC scroll thumb |
| **Toolbars** | `src/kits/plugins/fixed-toolbar-kit.tsx`, `floating-toolbar-kit.tsx` | `beforeEditable` / `afterEditable` → `FixedToolbar` + `FixedToolbarButtons` |
| **Full toolbar UI** | `src/ui/fixed-toolbar-buttons.tsx` | Undo/redo, AI, import/export, insert, turn-into, font size, colors, marks, align, lists+todo, link, table, emoji, media (img/video/audio/file), line height, indent, more, highlight, comment, mode |

**Hypowork today**

| Layer | Location | Gap |
|--------|----------|-----|
| **Document editor** | `PlateMarkdownDocumentEditor.tsx` | Custom `buildPlugins` + **custom** `FullDocumentToolbar` (`@udecode/toolbar`), **not** the shared `ui/fixed-toolbar-buttons.tsx` |
| **Kit stub** | `kits/editor-kit.tsx` | Only: paragraph, headings, blockquote, basic marks, list, indent, link, autoformat, **fixed + floating kits** (those kits point at **minimal** `components/ui/fixed-toolbar-buttons.tsx`) |
| **Fixed toolbar UI** | `components/ui/fixed-toolbar-buttons.tsx` | **Much smaller** than plate-main (bold…blockquote only) |

---

## 2. Feature matrix (kits in `plate-main` → hypowork status)

Legend: **✓** present / partial · **○** stub only · **—** not in hypowork

| Kit / area | plate-main `vite-markdown` | hypowork `PlateMarkdownDocumentEditor` | Notes |
|------------|---------------------------|----------------------------------------|--------|
| **AI (mod+J, etc.)** | `AIKit` | Partial — Copilot behind env | Wire `VITE_PLATE_COMPLETION_API` + port AI toolbar pieces |
| **Block menu** | `BlockMenuKit` | — | Needs UI + block plugins |
| **Basic blocks** | `BasicBlocksKit` | Partial — `BaseBasicBlocksPlugin` | Align HR, etc. with MD rules |
| **Code block** | `CodeBlockKit` | ✓ `CodeBlockPlugin` | MD + fence |
| **Code drawing** | `CodeDrawingKit` | — | Optional / heavy |
| **Table** | `TableKit` | ✓ `TablePlugin` | GFM tables |
| **Toggle** | `ToggleKit` | — | MD extension or skip |
| **TOC** | `TocKit` | — | Often separate sidebar |
| **Media** | `MediaKit` | Partial — image URL | Video/audio/file need upload + embed policy |
| **Callout** | `CalloutKit` | — | Needs MD or HTML fallback |
| **Columns** | `ColumnKit` | — | Usually not in plain MD |
| **Math** | `MathKit` | ✓ `EquationPlugin` / inline | `remark-math` already |
| **Date** | `DateKit` | — | Product |
| **Link** | `LinkKit` | ✓ `LinkPlugin` | |
| **Mention** | `MentionKit` | — | Needs backend |
| **Basic marks** | `BasicMarksKit` | ✓ | |
| **Font** | `FontKit` | — | Size/color — partial in custom toolbar |
| **List + indent** | `ListKit`, `IndentKit` | ✓ | |
| **Align / line height** | `AlignKit`, `LineHeightKit` | Partial — `TextAlignPlugin` | Toolbar parity |
| **Discussion / comment / suggestion** | `DiscussionKit`, `CommentKit`, `SuggestionKit` | — | Collaboration + backend |
| **Slash** | `SlashKit` | — | High UX value |
| **Autoformat** | `AutoformatKit` | ✓ | |
| **Cursor overlay** | `CursorOverlayKit` | — | Multiplayer |
| **DnD** | `DndKit` | — | Needs `@dnd-kit` + deps |
| **Emoji** | `EmojiKit` | — | |
| **Exit break** | `ExitBreakKit` | — | |
| **Trailing block** | `TrailingBlockPlugin` | — | Nice for UX |
| **DOCX** | `DocxKit` | — | Import/export |
| **Markdown** | `MarkdownKit` | ✓ `MarkdownPlugin` | Core for documents |
| **Block placeholder** | `BlockPlaceholderKit` | — | UX |
| **Fixed / floating toolbar** | `FixedToolbarKit`, `FloatingToolbarKit` | Different impl | **Port** `fixed-toolbar-buttons` or unify on **one** toolbar system |

---

## 3. Recommended phases (ordered)

### Phase A — **Unify editor composition** (foundation)

1. **Single source of plugins** for documents: either expand `kits/editor-kit.tsx` to match `plate-main`’s `EditorKit` shape (incrementally) **or** move `buildPlugins` into a `document-editor-kit.ts` that exports the same list used by tests and app.
2. **Pick one toolbar stack**:
   - **Option 1 (align with plate-main):** `@udecode/plate-toolbar` patterns + `FixedToolbar` + port `fixed-toolbar-buttons.tsx` from `plate-main` (adapt imports to `@/components/ui/*`).
   - **Option 2:** Keep `@udecode/toolbar` but **replicate** button groups from `plate-main` until parity.
3. **Plate shell** (already learned): `Plate` → wrapper `flex flex-col` → toolbar row (`shrink-0`, `useEditorRef(editor.id)`) → `PlateContent` `id={editor.id}`.

### Phase B — **Toolbar parity** (no new block types)

- Undo/redo, **turn into**, insert menu, font size, **highlight**, background/text color (requires **FontKit** / highlight plugins).
- Align, line height, list **todo**, indent/outdent, **more** overflow menu.
- **Import/export** (Markdown is already “save”; add **export** as download / **import** file if product wants).

### Phase C — **Rich blocks** (schema + MD)

- **Media** (upload URLs + storage), **table** polish, **callout** / **toggle** if product accepts non-MD or extended MD.
- **Slash command** (`SlashKit`) — large UX win.

### Phase D — **Collaboration / AI** (optional)

- **Comments / suggestions** — needs backend + auth.
- **AI** — full `AIKit` + same shortcuts as `vite-markdown` (see `use-chat.ts` patterns there).

### Phase E — **Engine sync** (`hypowork/packages/editor`)

- Periodically **merge upstream** from `plate-main` (or `udecode/plate`) into `packages/editor` and **pin** `pnpm.overrides` for `@platejs/core` / `platejs` like today.
- Run **one** `vite build` / smoke tests after each bump to catch duplicate `@platejs/core` instances.

---

## 4. Concrete “next” tasks (short list)

1. **Replace** `hypowork/client/src/components/ui/fixed-toolbar-buttons.tsx` with a **port** of `plate-main/apps/vite-markdown/src/ui/fixed-toolbar-buttons.tsx`, pulling in **only** the dependencies that are already in `package.json` or add them; wire **scoped** `useEditorRef(editor.id)` where needed.
2. **Use** `FixedToolbar` + `FixedToolbarButtons` from `kits/fixed-toolbar-kit.tsx` **inside** `PlateMarkdownDocumentEditor` (with `toolbar` **outside** Slate, same pattern as now) **or** merge `FullDocumentToolbar` into **one** component that mirrors plate-main groups.
3. **Expand** `plugins` array in `PlateMarkdownDocumentEditor` **or** delegate to `EditorKit` + extra markdown/copilot plugins.
4. **Document** in `REPORT.md` which node types are **supported in Markdown body** vs **export-only** (HTML).

---

## 5. Files to treat as canonical copy sources

| plate-main | hypowork target |
|------------|-----------------|
| `apps/vite-markdown/src/kits/editor-kit.tsx` | `kits/editor-kit.tsx` (expand) |
| `apps/vite-markdown/src/kits/plugins/*.tsx` | `kits/plugins/` (add as needed) |
| `apps/vite-markdown/src/ui/fixed-toolbar*.tsx` | `components/ui/fixed-toolbar*.tsx` |
| `apps/vite-markdown/src/ui/*-toolbar-button.tsx` | `components/ui/` (incremental) |

---

*This is a **plan** only; no obligation to implement every kit—choose phases by product (Markdown-only vs rich doc).*
