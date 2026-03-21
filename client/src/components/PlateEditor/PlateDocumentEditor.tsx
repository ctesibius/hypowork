'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Plate,
  PlateContent,
  ParagraphPlugin,
  createPlatePlugin,
  usePlateEditor,
} from '@platejs/core/react';
import {
  BaseBasicMarksPlugin,
  BaseHeadingPlugin,
  BaseBasicBlocksPlugin,
} from '@platejs/basic-nodes';
import {
  AutoformatPlugin,
  autoformatArrow,
  autoformatLegal,
  autoformatLegalHtml,
  autoformatMath,
  autoformatPunctuation,
  autoformatSmartQuotes,
  type AutoformatRule,
} from '@platejs/autoformat';
import { indent, outdent } from '@platejs/indent';
import { IndentPlugin } from '@platejs/indent/react';
import { ListStyleType, toggleList } from '@platejs/list';
import { ListPlugin } from '@platejs/list/react';
import { LinkPlugin } from '@platejs/link/react';
import { upsertLink } from '@platejs/link';
import { KEYS } from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { useEditorRef } from 'platejs/react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Link2,
} from 'lucide-react';

import { setBlockType } from './plate-editor-transforms';

/** Empty document — paragraph plugin expects `p` nodes. */
const defaultEditorValue = [{ type: 'p', children: [{ text: '' }] }];

function buildAutoformatRules(): AutoformatRule[] {
  const autoformatMarks: AutoformatRule[] = [
    { match: '**', mode: 'mark', type: KEYS.bold },
    { match: '__', mode: 'mark', type: KEYS.underline },
    { match: '*', mode: 'mark', type: KEYS.italic },
    { match: '_', mode: 'mark', type: KEYS.italic },
    { match: '~~', mode: 'mark', type: KEYS.strikethrough },
    { match: '`', mode: 'mark', type: KEYS.code },
  ];

  const autoformatBlocks: AutoformatRule[] = [
    { match: '# ', mode: 'block', type: KEYS.h1 },
    { match: '## ', mode: 'block', type: KEYS.h2 },
    { match: '### ', mode: 'block', type: KEYS.h3 },
    { match: '#### ', mode: 'block', type: KEYS.h4 },
    { match: '##### ', mode: 'block', type: KEYS.h5 },
    { match: '###### ', mode: 'block', type: KEYS.h6 },
    { match: '> ', mode: 'block', type: KEYS.blockquote },
  ];

  const autoformatLists: AutoformatRule[] = [
    {
      match: ['* ', '- '],
      mode: 'block',
      type: 'list',
      format: (editor) => {
        toggleList(editor, { listStyleType: ListStyleType.Disc });
      },
    },
    {
      match: [String.raw`^\d+\.$ `, String.raw`^\d+\)$ `],
      matchByRegex: true,
      mode: 'block',
      type: 'list',
      format: (editor, { matchString }) => {
        toggleList(editor, {
          listRestartPolite: Number(matchString) || 1,
          listStyleType: ListStyleType.Decimal,
        });
      },
    },
  ];

  return [
    ...autoformatBlocks,
    ...autoformatMarks,
    ...autoformatSmartQuotes,
    ...autoformatPunctuation,
    ...autoformatLegal,
    ...autoformatLegalHtml,
    ...autoformatArrow,
    ...autoformatMath,
    ...autoformatLists,
  ];
}

interface PlateDocumentEditorProps {
  initialValue?: any[];
  onChange?: (value: any[]) => void;
  className?: string;
  readOnly?: boolean;
}

/**
 * Plate toolbar hooks (`useMarkToolbarButtonState`, etc.) read `editor.api` via jotai and crash
 * if they run in the same render pass as the first `PlateContent` paint. We defer the real
 * toolbar to after mount and use imperative `editor.tf` / transforms only (no those hooks).
 */
function DeferredDocumentToolbar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(true);
  }, []);
  if (!show) {
    return <div className="h-10 shrink-0 border-b border-border bg-muted/30" aria-hidden />;
  }
  return <PlateDocumentToolbar />;
}

function PlateDocumentToolbar() {
  const editor = useEditorRef() as PlateEditor;

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="flex flex-col gap-1 border-b border-border bg-background p-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Paragraph"
          onMouseDown={run(() => setBlockType(editor, KEYS.p))}
        >
          <Pilcrow className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Heading 1"
          onMouseDown={run(() => setBlockType(editor, KEYS.h1))}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Heading 2"
          onMouseDown={run(() => setBlockType(editor, KEYS.h2))}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Heading 3"
          onMouseDown={run(() => setBlockType(editor, KEYS.h3))}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Bold"
          onMouseDown={run(() => editor.tf.toggleMark(KEYS.bold))}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Italic"
          onMouseDown={run(() => editor.tf.toggleMark(KEYS.italic))}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Underline"
          onMouseDown={run(() => editor.tf.toggleMark(KEYS.underline))}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Strikethrough"
          onMouseDown={run(() => editor.tf.toggleMark(KEYS.strikethrough))}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Code"
          onMouseDown={run(() => editor.tf.toggleMark(KEYS.code))}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Blockquote"
          onMouseDown={run(() => setBlockType(editor, KEYS.blockquote))}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Link"
          onMouseDown={run(() => {
            const raw = window.prompt('Link URL (https://…)');
            if (raw == null) return;
            const url = raw.trim();
            if (!url) return;
            upsertLink(editor, { url });
          })}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Bulleted list"
          onMouseDown={run(() =>
            toggleList(editor, {
              listStyleType: ListStyleType.Disc,
            }),
          )}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Numbered list"
          onMouseDown={run(() =>
            toggleList(editor, {
              listStyleType: ListStyleType.Decimal,
            }),
          )}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Indent"
          onMouseDown={run(() => indent(editor))}
        >
          <IndentIncrease className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          type="button"
          title="Outdent"
          onMouseDown={run(() => outdent(editor))}
        >
          <IndentDecrease className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const documentToolbarPlugin = createPlatePlugin({
  key: 'hypowork-document-toolbar',
  render: {
    beforeEditable: () => <DeferredDocumentToolbar />,
  },
});

export function PlateDocumentEditor({
  initialValue,
  onChange,
  className,
  readOnly,
}: PlateDocumentEditorProps) {
  const plugins = useMemo(
    () => [
      ParagraphPlugin,
      BaseBasicMarksPlugin,
      BaseHeadingPlugin,
      BaseBasicBlocksPlugin,
      LinkPlugin,
      IndentPlugin.configure({
        inject: {
          targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote],
        },
      }),
      ListPlugin.configure({
        inject: {
          targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote],
        },
      }),
      ...(readOnly ? [] : [documentToolbarPlugin]),
      AutoformatPlugin.configure({
        options: {
          enableUndoOnDelete: true,
          rules: buildAutoformatRules(),
        },
      }),
    ],
    [readOnly],
  );

  const editor = usePlateEditor({
    plugins,
    value: initialValue ?? defaultEditorValue,
  });

  return (
    <div className={cn('flex min-h-0 flex-col rounded-md border border-input bg-background', className)}>
      <Plate
        editor={editor}
        readOnly={readOnly}
        onValueChange={({ value }) => onChange?.(value as any[])}
      >
        <PlateContent
          className={cn(
            'prose prose-sm dark:prose-invert min-h-[300px] max-w-none px-4 py-3 outline-none focus:outline-none',
            'prose-a:text-primary prose-a:underline',
          )}
          placeholder={readOnly ? undefined : 'Type here… Try "# " for a heading.'}
        />
      </Plate>
    </div>
  );
}

export default PlateDocumentEditor;
