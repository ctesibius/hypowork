---
name: plate-app-with-toc-thumb
description: Build a Plate-based app by wiring workspace packages and implementing editor UI; add a local TOC/scroll thumb when the package thumb doesn't render (e.g. Tailwind not scanning package dist). Use when scaffolding a new app like vite-markdown, integrating @platejs/toc, or fixing invisible ScrollThumb.
---

# Build a Plate App With Optional Local TOC Thumb

Use this skill when a user wants to build their own app that uses Plate packages (e.g. editor, TOC) and may need a **local** scroll/TOC thumb when the one from `@platejs/toc` doesn’t show (e.g. Tailwind not scanning package `dist`).

## Overview

1. **Use/copy packages** – Depend on Plate workspace packages in the app.
2. **Implement editor shell** – Editor files that import from packages and wire `Plate`, `EditorContainer`, `Editor`, plugins.
3. **TOC thumb** – Prefer `ScrollThumb` from `@platejs/toc`; if it doesn’t render (no styles), implement a **local** scroll thumb that uses the same scroll/heading logic.

## 1. Wire Packages in the App

- In the app’s `package.json`, add workspace deps for the packages you need, e.g.:
  - `platejs`, `@platejs/core`, `@platejs/slate`, `@platejs/basic-nodes`, `@platejs/markdown`, etc.
  - `@platejs/toc` for TOC/sidebar and (optionally) ScrollThumb.
- Use `workspace:^` (or your monorepo protocol) so the app uses local packages.
- Run install/build from the repo root so packages are built and linkable.

## 2. Editor Files That Import Packages

- **Entry (e.g. App.tsx)**
  - `usePlateEditor({ plugins, value })`, render `<Plate editor={editor}>`.
  - Inside Plate: a wrapper (e.g. editor card with `ref` for the thumb), then:
    - `<EditorContainer>` (from your editor UI) wrapping `<Editor>` (from your editor UI).
    - Your TOC thumb (local or from package) and any sidebar.
- **Editor UI module**
  - Re-export or wrap `PlateContainer` / `PlateContent` from `platejs/react` with your layout and class names (e.g. `EditorContainer` with `overflow-y-auto`, `Editor` with placeholder and variants).
  - Keep the scroll container as the single div that gets `ref` from Plate (containerRef/scrollRef) so the thumb can use `useScrollRef()` and attach scroll listeners to it.
- **Plugins**
  - Import and merge the Plate plugins you need (basic-nodes, markdown, toc, etc.) in a `plugins.ts` (or similar) and pass them to `usePlateEditor`.

## 3. TOC Thumb: Package vs Local

### Try the package first

- Import `ScrollThumb` from `@platejs/toc` and render it inside the editor card (sibling of `EditorContainer` or as documented by the package).
- Ensure Tailwind can see the package’s classes: in the app’s Tailwind config (e.g. `@source` in CSS or `content` in tailwind.config), include the package’s built output, e.g.:
  - `@source "../node_modules/@platejs/toc/dist/**/*.js";`
- If the thumb still doesn’t appear (no styles / wrong specificity), the app build often doesn’t scan package `dist` reliably — **add a local scroll thumb** instead.

### When to add a local TOC thumb

- The package `ScrollThumb` renders in the DOM but is **invisible** (no background, no marks).
- You don’t want to rely on Tailwind scanning the package’s `dist` for the app build.

### How to implement a local scroll thumb

- **Location** – Add a file in the app source that your bundler and Tailwind definitely scan, e.g. `src/ui/scroll-thumb.tsx`.
- **Behavior (match package/ref app)**
  - Use `useScrollRef()` from `platejs/react` to get the editor’s scroll container.
  - Query headings (`h1,h2,h3`) inside that container; compute positions relative to the scroll container (e.g. `getBoundingClientRect` relative to container + `scrollTop`) so scroll sync works with nested DOM.
  - On container scroll: update active heading and a “window” offset for the visible slice of marks; keep a fixed-height track and center the marks between up/down arrows.
  - On mark click: scroll container to the heading using position relative to container (e.g. `getBoundingClientRect`-based `targetTop`), with `behavior: 'smooth'`.
  - Optional: `anchorRef` + `position: 'sticky'` to keep the thumb viewport-fixed and aligned to the editor card’s right edge, with `position: fixed` and `right` updated from the anchor’s rect on window scroll/resize.
- **Styling** – Use app-local Tailwind classes and/or inline styles so the thumb is always styled without depending on package `dist` scanning. Define any CSS variables (e.g. `--thumb-mark`, `--thumb-bg`) in the app’s global CSS.
- **Distinguishing from package** – If both package and local thumb can mount, make the local one obvious (e.g. a small “Vite” badge, or a data attribute like `data-vite-thumb`) and/or position it slightly higher so they don’t overlap.

## 4. Checklist for “Build an app like this”

- [ ] App depends on required Plate packages via workspace.
- [ ] Editor entry uses `Plate` + `EditorContainer` + `Editor` and passes a single scroll container ref into Plate’s context.
- [ ] Plugins array includes toc and any other needed plugins.
- [ ] TOC thumb: try `@platejs/toc` `ScrollThumb` first; if invisible, add a local scroll thumb in app source with the behavior above and app-local styles.
- [ ] If using Tailwind: include package `dist` in sources only if you rely on package thumb; otherwise rely on local thumb and app CSS/source for styles.
- [ ] Popover/dropdown backgrounds: define `--popover` / `--color-popover` (and foreground) in theme so dropdowns have an opaque background.

## 5. References in This Repo

- **App layout and thumb usage**: `apps/vite-markdown/src/App.tsx` (editor card ref, `ScrollThumb` with `anchorRef`, `position="sticky"`).
- **Editor shell**: `apps/vite-markdown/src/ui/editor.tsx` (EditorContainer, Editor variants).
- **Local scroll thumb**: `apps/vite-markdown/src/ui/scroll-thumb.tsx` (useScrollRef, headings, scroll sync, click-to-scroll, fixed track height, optional anchorRef/sticky).
- **Tailwind and package source**: `apps/vite-markdown/src/index.css` (`@source` for toolbar and toc; theme and `--popover`).
- **Package ScrollThumb (fallback reference)**: `packages/toc/src/react/ScrollThumb.tsx`.
