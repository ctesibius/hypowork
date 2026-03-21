# Implementation Plan: Full-Featured PlateDocumentEditor

**File:** `hypowork/client/src/components/PlateEditor/PlateDocumentEditor.tsx`  
**Reference:** `plate-main/apps/vite-markdown/src/`  
**Date:** 2026-03-20

**Update (parity roadmap):** See **[FEATURE_PARITY_PLAN.md](./FEATURE_PARITY_PLAN.md)** for a kit-by-kit comparison vs `plate-main/apps/vite-markdown`, phased rollout, and how `hypowork/packages/editor` fits in.

---

## PHASE 1: Critical Bug Fixes ⚡

### Step 1.1: Create missing `plate-editor-transforms.ts`
**File:** `hypowork/client/src/components/PlateEditor/plate-editor-transforms.ts`

```typescript
import type { PlateEditor } from '@platejs/core/react';
import type { NodeEntry, TElement } from '@platejs/slate';
import { KEYS } from '@platejs/basic-nodes';

/** Turn selected block(s) into `type` (heading, paragraph, blockquote). Clears list wrapper when present. */
export function setBlockType(editor: PlateEditor, type: string) {
  editor.tf.withoutNormalizing(() => {
    const entries = editor.api.blocks({ mode: 'lowest' });
    entries.forEach((entry: NodeEntry<TElement>) => {
      const [node, path] = entry;
      if ((node as Record<string, unknown>)[KEYS.listType]) {
        editor.tf.unsetNodes([KEYS.listType, 'indent'] as unknown as string[], { at: path });
      }
      if (node.type !== type) {
        editor.tf.setNodes({ type }, { at: path });
      }
    });
  });
}
```

### Step 1.2: Fix import paths
- Change `import { useEditorRef } from 'platejs/react'` to `import { useEditorRef } from '@platejs/core/react'`
- Change `import { KEYS } from 'platejs'` to `import { KEYS } from '@platejs/basic-nodes'`
- Change `import type { PlateEditor } from 'platejs/react'` to `import type { PlateEditor } from '@platejs/core/react'`

---

## PHASE 2: Plugin Architecture 🔧

### Step 2.1: Create EditorKit composition file
**File:** `hypowork/client/src/components/PlateEditor/kits/editor-kit.ts`

```typescript
'use client';

import { TrailingBlockPlugin } from '@platejs/core';
import { AIKit } from '@platejs/ai';
import { AlignKit } from '@platejs/align';
import { AutoformatKit } from '@platejs/autoformat';
import { BasicBlocksKit, BasicMarksKit, BasicNodesKit } from '@platejs/basic-nodes';
import { BlockMenuKit } from '@platejs/block-menu';
import { CalloutKit } from '@platejs/callout';
import { CodeBlockKit } from '@platejs/code-block';
import { DateKit } from '@platejs/date';
import { DocxKit } from '@platejs/docx';
import { EmojiKit } from '@platejs/emoji';
import { ExitBreakKit } from '@platejs/break';
import { FixedToolbarKit } from './fixed-toolbar-kit';
import { FloatingToolbarKit } from './floating-toolbar-kit';
import { FontKit } from '@platejs/font';
import { IndentKit } from '@platejs/indent';
import { LineHeightKit } from '@platejs/line-height';
import { LinkKit } from '@platejs/link';
import { ListKit } from '@platejs/list';
import { MarkdownKit } from '@platejs/markdown';
import { MathKit } from '@platejs/math';
import { MediaKit } from '@platejs/media';
import { MentionKit } from '@platejs/mention';
import { SlashKit } from '@platejs/slash-command';
import { SuggestionKit } from '@platejs/suggestion';
import { TableKit } from '@platejs/table';
import { ToggleKit } from '@platejs/toggle';

// Full-featured editor kit - same as plate-main's EditorKit
export const EditorKit = [
  // AI
  ...AIKit,
  
  // Elements
  ...BasicBlocksKit,
  ...BasicMarksKit,
  ...BasicNodesKit,
  ...CodeBlockKit,
  ...TableKit,
  ...ToggleKit,
  ...MediaKit,
  ...CalloutKit,
  ...LinkKit,
  ...MentionKit,
  ...MathKit,
  ...DateKit,
  ...EmojiKit,
  
  // Marks
  ...FontKit,
  ...AlignKit,
  ...LineHeightKit,
  ...IndentKit,
  ...ListKit,
  
  // Editing
  ...SlashKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  
  // Import/Export
  ...DocxKit,
  ...MarkdownKit,
  
  // UI
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
  ...BlockMenuKit,
  
  // Collaboration (optional)
  // ...CommentKit,
  // ...SuggestionKit,
  
  TrailingBlockPlugin,
];
```

### Step 2.2: Create FixedToolbarKit
**File:** `hypowork/client/src/components/PlateEditor/kits/fixed-toolbar-kit.ts`

```typescript
'use client';

import { createPlatePlugin } from '@platejs/core/react';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/components/ui/fixed-toolbar-buttons';

export const FixedToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <FixedToolbar className="z-10 min-h-[2.5rem] shrink-0">
          <FixedToolbarButtons />
        </FixedToolbar>
      ),
    },
  }),
];
```

### Step 2.3: Create FloatingToolbarKit
**File:** `hypowork/client/src/components/PlateEditor/kits/floating-toolbar-kit.ts`

```typescript
'use client';

import { createPlatePlugin } from '@platejs/core/react';
import { FloatingToolbar } from '@/components/ui/floating-toolbar';
import { FloatingToolbarButtons } from '@/components/ui/floating-toolbar-buttons';

export const FloatingToolbarKit = [
  createPlatePlugin({
    key: 'floating-toolbar',
    render: {
      belowEditable: () => (
        <FloatingToolbar>
          <FloatingToolbarButtons />
        </FloatingToolbar>
      ),
    },
  }),
];
```

---

## PHASE 3: UI Components 🎨

### Step 3.1: Create Fixed Toolbar
**File:** `hypowork/client/src/components/ui/fixed-toolbar.tsx`

```typescript
'use client';

import type { ComponentProps } from 'react';
import { FixedToolbar as FixedToolbarBase } from '@udecode/toolbar';

export function FixedToolbar(props: ComponentProps<typeof FixedToolbarBase>) {
  return (
    <div className="sticky top-0 z-10 min-h-[2.5rem] w-full shrink-0 border-b border-border bg-background">
      <FixedToolbarBase {...props} />
    </div>
  );
}
```

### Step 3.2: Create ToolbarButton component
**File:** `hypowork/client/src/components/ui/toolbar-button.tsx`

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ToolbarButtonProps extends React.ComponentProps<typeof Button> {
  active?: boolean;
  tooltip?: string;
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, active, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8',
        active && 'bg-accent text-accent-foreground',
        className
      )}
      {...props}
    />
  )
);
ToolbarButton.displayName = 'ToolbarButton';
```

### Step 3.3: Create ToolbarGroup component
**File:** `hypowork/client/src/components/ui/toolbar-group.tsx`

```typescript
'use client';

import { cn } from '@/lib/utils';

export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      {...props}
    />
  );
}
```

### Step 3.4: Create FixedToolbarButtons
**File:** `hypowork/client/src/components/ui/fixed-toolbar-buttons.tsx`

```typescript
'use client';

import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
} from 'lucide-react';
import { KEYS } from '@platejs/basic-nodes';
import { useMarkToolbarButtonState, useMarkToolbarButton } from '@platejs/core/react';

import { ToolbarButton } from './toolbar-button';
import { ToolbarGroup } from './toolbar-group';

// Helper to create mark toolbar buttons
function MarkToolbarButton({
  nodeType,
  tooltip,
  children,
}: {
  nodeType: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props: buttonProps } = useMarkToolbarButton(state);
  
  return (
    <ToolbarButton tooltip={tooltip} {...buttonProps}>
      {children}
    </ToolbarButton>
  );
}

export function FixedToolbarButtons() {
  return (
    <div className="flex w-full">
      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
          <BoldIcon className="h-4 w-4" />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
          <ItalicIcon className="h-4 w-4" />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline (⌘+U)">
          <UnderlineIcon className="h-4 w-4" />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <StrikethroughIcon className="h-4 w-4" />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
          <CodeIcon className="h-4 w-4" />
        </MarkToolbarButton>
      </ToolbarGroup>
      
      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <ListIcon className="h-4 w-4" />
        </MarkToolbarButton>
      </ToolbarGroup>
      
      <div className="grow" />
    </div>
  );
}
```

---

## PHASE 4: Node Components 📦

### Step 4.1: Create Heading nodes
**File:** `hypowork/client/src/components/ui/heading-node.tsx`

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface HeadingElementProps {
  attributes: React.HTMLAttributes<HTMLHeadingElement>;
  element: { level?: number };
  children: React.ReactNode;
}

const headingStyles = {
  1: 'text-4xl font-bold',
  2: 'text-3xl font-bold',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-semibold',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
};

export const H1Element = React.forwardRef<HTMLHeadingElement, HeadingElementProps>(
  ({ attributes, children, ...props }, ref) => (
    <h1 ref={ref} {...attributes} className={cn(headingStyles[1], 'mb-4 mt-6 first:mt-0')} {...props}>
      {children}
    </h1>
  )
);

export const H2Element = React.forwardRef<HTMLHeadingElement, HeadingElementProps>(
  ({ attributes, children, ...props }, ref) => (
    <h2 ref={ref} {...attributes} className={cn(headingStyles[2], 'mb-3 mt-5')} {...props}>
      {children}
    </h2>
  )
);

export const H3Element = React.forwardRef<HTMLHeadingElement, HeadingElementProps>(
  ({ attributes, children, ...props }, ref) => (
    <h3 ref={ref} {...attributes} className={cn(headingStyles[3], 'mb-2 mt-4')} {...props}>
      {children}
    </h3>
  )
);
```

### Step 4.2: Create Paragraph node
**File:** `hypowork/client/src/components/ui/paragraph-node.tsx`

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ParagraphElementProps {
  attributes: React.HTMLAttributes<HTMLParagraphElement>;
  element: Record<string, unknown>;
  children: React.ReactNode;
}

export const ParagraphElement = React.forwardRef<HTMLParagraphElement, ParagraphElementProps>(
  ({ attributes, children, ...props }, ref) => (
    <p ref={ref} {...attributes} className="mb-4 last:mb-0" {...props}>
      {children}
    </p>
  )
);
```

### Step 4.3: Create Blockquote node
**File:** `hypowork/client/src/components/ui/blockquote-node.tsx`

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BlockquoteElementProps {
  attributes: React.HTMLAttributes<HTMLQuoteElement>;
  element: Record<string, unknown>;
  children: React.ReactNode;
}

export const BlockquoteElement = React.forwardRef<HTMLQuoteElement, BlockquoteElementProps>(
  ({ attributes, children, ...props }, ref) => (
    <blockquote
      ref={ref}
      {...attributes}
      className={cn(
        'mt-4 mb-4 border-l-4 border-primary pl-4 italic text-muted-foreground',
      )}
      {...props}
    >
      {children}
    </blockquote>
  )
);
```

---

## PHASE 5: Update PlateDocumentEditor 🏗️

### Step 5.1: Simplified component
**File:** `hypowork/client/src/components/PlateEditor/PlateDocumentEditor.tsx` (refactored)

```typescript
'use client';

import React, { useMemo } from 'react';
import { Plate, PlateContent } from '@platejs/core/react';
import { usePlateEditor } from '@platejs/core/react';
import { EditorKit } from './kits/editor-kit';
import { cn } from '@/lib/utils';

interface PlateDocumentEditorProps {
  initialValue?: any[];
  onChange?: (value: any[]) => void;
  className?: string;
  readOnly?: boolean;
}

export function PlateDocumentEditor({
  initialValue,
  onChange,
  className,
  readOnly,
}: PlateDocumentEditorProps) {
  const editor = usePlateEditor({
    plugins: useMemo(() => EditorKit, []),
    value: initialValue ?? [{ type: 'p', children: [{ text: '' }] }],
    shouldNormalize: true,
  });

  return (
    <div className={cn('flex min-h-0 flex-col rounded-md border border-input bg-background', className)}>
      <Plate
        editor={editor}
        readOnly={readOnly}
        onValueChange={({ value }) => onChange?.(value as any[])}
      >
        <PlateContent
          className="min-h-[300px] px-4 py-3 outline-none focus:outline-none"
          placeholder={readOnly ? undefined : 'Start typing...'}
        />
      </Plate>
    </div>
  );
}

export default PlateDocumentEditor;
```

---

## PHASE 6: Add Advanced Features (Optional) 🚀

### Step 6.1: Media support
Add `MediaToolbarButton` component and `MediaUploadToast`

### Step 6.2: Table support
Add table insertion and cell editing UI

### Step 6.3: AI integration
Configure `@platejs/ai` for AI commands

### Step 6.4: Slash commands
Configure `@platejs/slash-command` for block insertion menu

### Step 6.5: Collaboration
Add Y.js provider for real-time collaboration

---

## Dependencies to Add to client/package.json

```json
{
  "@platejs/ai": "workspace:*",
  "@platejs/align": "workspace:*",
  "@platejs/autoformat": "workspace:*",
  "@platejs/basic-nodes": "workspace:*",
  "@platejs/block-menu": "workspace:*",
  "@platejs/callout": "workspace:*",
  "@platejs/code-block": "workspace:*",
  "@platejs/date": "workspace:*",
  "@platejs/docx": "workspace:*",
  "@platejs/emoji": "workspace:*",
  "@platejs/font": "workspace:*",
  "@platejs/line-height": "workspace:*",
  "@platejs/markdown": "workspace:*",
  "@platejs/math": "workspace:*",
  "@platejs/media": "workspace:*",
  "@platejs/mention": "workspace:*",
  "@platejs/slash-command": "workspace:*",
  "@platejs/table": "workspace:*",
  "@platejs/toggle": "workspace:*",
  "@platejs/break": "workspace:*",
  "@udecode/toolbar": "workspace:*"
}
```

---

## Implementation Order

1. **Phase 1:** Fix critical bugs (B1-B5)
2. **Phase 2:** Create kit architecture
3. **Phase 3:** Build UI components
4. **Phase 4:** Create node components
5. **Phase 5:** Update PlateDocumentEditor
6. **Phase 6:** Add advanced features

---

## Files to Create/Modify

| Phase | File | Action |
|-------|------|--------|
| 1 | `plate-editor-transforms.ts` | Create |
| 2 | `kits/editor-kit.ts` | Create |
| 2 | `kits/fixed-toolbar-kit.ts` | Create |
| 2 | `kits/floating-toolbar-kit.ts` | Create |
| 3 | `ui/fixed-toolbar.tsx` | Create |
| 3 | `ui/toolbar-button.tsx` | Create |
| 3 | `ui/toolbar-group.tsx` | Create |
| 3 | `ui/fixed-toolbar-buttons.tsx` | Create |
| 4 | `ui/heading-node.tsx` | Create |
| 4 | `ui/paragraph-node.tsx` | Create |
| 4 | `ui/blockquote-node.tsx` | Create |
| 5 | `PlateDocumentEditor.tsx` | Modify |
| - | `client/package.json` | Modify |
