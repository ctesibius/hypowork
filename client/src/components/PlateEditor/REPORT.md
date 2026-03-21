# Bug Report & Feature Gap Analysis: PlateDocumentEditor

**File:** `hypowork/client/src/components/PlateEditor/PlateDocumentEditor.tsx`  
**Reference:** `plate-main/apps/vite-markdown/src/`  
**Date:** 2026-03-20

---

## BUGS

### B1: Missing `plate-editor-transforms.ts` file
**Severity:** 🔴 Critical (compile error)  
**Status:** The file is imported but does not exist in the repo.

```tsx
// Line 11 - import that will fail
import { setBlockType } from './plate-editor-transforms';
```

**Fix:** Create `plate-editor-transforms.ts` in the same directory with the `setBlockType` function.

---

### B2: Incorrect import path for `useEditorRef`
**Severity:** 🟡 Warning  
**Current:**
```tsx
import { useEditorRef } from 'platejs/react';
```
**Issue:** Should use `@platejs/core/react` to match other imports.

---

### B3: Type cast `as PlateEditor` is unsafe
**Severity:** 🟡 Warning  
**Current:**
```tsx
const editor = useEditorRef() as PlateEditor;
```
**Issue:** Loses generic type info. Should use proper typing.

---

### B4: Autoformat list rules use wrong `format` signature
**Severity:** 🟡 Warning  
**Current:**
```tsx
format: (editor) => {
  toggleList(editor, { listStyleType: ListStyleType.Disc });
},
```
**Issue:** The `format` function should return `boolean | void`, not void. Also, list toggle logic may not work correctly with autoformat.

---

### B5: `KEYS` import from `platejs` is a barrel export
**Severity:** 🟢 Info  
**Current:**
```tsx
import { KEYS } from 'platejs';
```
**Issue:** Barrel exports hurt tree-shaking. Should import from specific packages.

---

## FEATURE GAPS (Missing from plate-main reference)

### G1: No UI Components for Block Types
**Missing files:**
- `blockquote-node.tsx`
- `heading-node.tsx` (H1-H6)
- `paragraph-node.tsx`
- `hr-node.tsx`

**Status:** Using default Plate rendering, no custom styled nodes.

---

### G2: No Fixed Toolbar Component
**Missing:** `@udecode/toolbar`-based toolbar  
**Reference:** `plate-main/apps/vite-markdown/src/ui/fixed-toolbar.tsx`

Current: Custom `PlateDocumentToolbar` using imperative `editor.tf`  
Target: Full `FixedToolbar` with `FixedToolbarButtons` using Plate hooks (`useMarkToolbarButtonState`, etc.)

---

### G3: Missing Toolbar Buttons
**Current toolbar has:** Bold, Italic, Underline, Strikethrough, Code, Blockquote, Link, Lists, Indent/Outdent

**Missing toolbar buttons:**
- [ ] Undo/Redo (HistoryToolbarButton)
- [ ] AI commands (AIToolbarButton)
- [ ] Export/Import (Docx, Markdown)
- [ ] Font size selector
- [ ] Font color (text color)
- [ ] Background color / Highlight
- [ ] Text alignment
- [ ] Todo list
- [ ] Toggle/collapsible content
- [ ] Table insert
- [ ] Emoji picker
- [ ] Media (image, video, audio, file)
- [ ] Line height
- [ ] More menu (additional options)
- [ ] Comment/Discussion

---

### G4: No Custom Node Components
**Missing UI nodes:**
- `code-block-node.tsx`
- `table-node.tsx`
- `callout-node.tsx`
- `media-image-node.tsx`
- `media-video-node.tsx`
- `media-audio-node.tsx`
- `link-node.tsx` (with floating toolbar)
- `mention-node.tsx`
- `emoji-node.tsx`
- `equation-node.tsx`
- `date-node.tsx`
- `excalidraw-node.tsx`

---

### G5: Missing Plugin Configuration
**Current plugins:**
```tsx
[
  ParagraphPlugin,
  BaseBasicMarksPlugin,
  BaseHeadingPlugin,
  BaseBasicBlocksPlugin,
  LinkPlugin,
  IndentPlugin,
  ListPlugin,
  documentToolbarPlugin,
  AutoformatPlugin,
]
```

**Missing plugins from EditorKit:**
- `AIKit` - AI commands integration
- `AlignKit` - Text alignment
- `BlockMenuKit` - Block context menu
- `CalloutKit` - Callout blocks
- `CodeBlockKit` - Syntax highlighted code
- `ColumnKit` - Multi-column layouts
- `CommentKit` - Comment threads
- `CursorOverlayKit` - Remote cursors
- `DateKit` - Date insertion
- `DiscussionKit` - Discussions
- `DndKit` - Drag and drop
- `DocxKit` - Word import/export
- `EmojiKit` - Emoji picker
- `ExitBreakKit` - Exit block shortcuts
- `FontKit` - Font styling
- `LineHeightKit` - Line height control
- `MarkdownKit` - Markdown import/export
- `MathKit` - Math equations
- `MediaKit` - Media (image, video, audio)
- `MentionKit` - @mentions
- `SlashKit` - Slash command menu
- `SuggestionKit` - Suggestion mode
- `TableKit` - Tables
- `TocKit` - Table of contents
- `ToggleKit` - Collapsible sections
- `TrailingBlockPlugin` - Auto trailing block

---

### G6: No Floating Toolbar for Links
**Missing:** Link floating toolbar that appears when text is selected  
**Reference:** `plate-main/apps/vite-markdown/src/ui/link-toolbar.tsx`

---

### G7: No EditorKit Composition Pattern
**Current:** Manual plugin list  
**Target:** Use `EditorKit` composition pattern with `.withComponent()` for custom nodes

---

### G8: Missing Parsers/Serializers
**Missing:**
- Docx import/export (`DocxKit`, `@platejs/docx`, `@platejs/docx-io`)
- Markdown import/export (`MarkdownKit`, `@platejs/markdown`)

---

### G9: No Block Placeholder/Selection
**Missing:**
- Block selection UI
- Block placeholder states
- Block drag handles

---

### G10: No Collaboration Features
**Missing:**
- Y.js integration (`@platejs/yjs`)
- Remote cursor overlays
- Comment/reaction system

---

## SUMMARY

| Category | Count |
|----------|-------|
| Critical Bugs | 1 |
| Warnings | 3 |
| Info | 1 |
| Missing UI Components | 15+ |
| Missing Plugins | 20+ |
| Missing Toolbar Buttons | 12+ |

**Priority:**
1. Fix B1 (critical compile error)
2. Add missing plugins that match plate-main's EditorKit
3. Implement custom node components
4. Replace custom toolbar with FixedToolbar/FixedToolbarButtons
5. Add advanced features (AI, collaboration, etc.)
