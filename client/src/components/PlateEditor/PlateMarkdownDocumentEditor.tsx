'use client';

import 'katex/dist/katex.min.css';

import React, { useMemo } from 'react';
import {
  Plate,
  PlateContent,
  createPlateEditor,
  ParagraphPlugin,
  useEditorRef,
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
import { setAlign } from '@platejs/basic-styles';
import { TextAlignPlugin } from '@platejs/basic-styles/react';
import { CodeBlockPlugin } from '@platejs/code-block/react';
import { indent, outdent } from '@platejs/indent';
import { IndentPlugin } from '@platejs/indent/react';
import { ListStyleType, toggleList } from '@platejs/list';
import { ListPlugin } from '@platejs/list/react';
import { LinkPlugin } from '@platejs/link/react';
import { upsertLink } from '@platejs/link';
import { deserializeMd, MarkdownPlugin, serializeMd } from '@platejs/markdown';
import { EquationPlugin, InlineEquationPlugin } from '@platejs/math/react';
import { insertEquation, insertInlineEquation } from '@platejs/math';
import { ImagePlugin } from '@platejs/media/react';
import { insertImage } from '@platejs/media';
import { insertTable } from '@platejs/table';
import { TablePlugin } from '@platejs/table/react';
import { toggleCodeBlock } from '@platejs/code-block';
import { CopilotPlugin, triggerCopilotSuggestion } from '@platejs/ai/react';
import { KEYS } from 'platejs';
import type { Value } from 'platejs';
import type { PlateEditor } from '@platejs/core/react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import * as RadixTooltip from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';
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
  Table2,
  Image as ImageIcon,
  Sigma,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Braces,
} from 'lucide-react';

import { ToolbarButton, ToolbarGroup, ToolbarSeparator } from '@udecode/toolbar';

import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { PlateEditorIdProvider } from '@/ui/plate-editor-scope';

import { setBlockType } from './plate-editor-transforms';

const completionApi =
  typeof import.meta.env.VITE_PLATE_COMPLETION_API === 'string'
    ? import.meta.env.VITE_PLATE_COMPLETION_API.trim()
    : '';

/** `PlateContent` returns `null` when `editor.children` is empty — that skips `beforeEditable` (toolbar). */
function ensureNonEmptyValue(v: Value | undefined): Value {
  if (Array.isArray(v) && v.length > 0) return v;
  return [{ type: 'p', children: [{ text: '' }] }];
}

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

function FullDocumentToolbar({ editorId }: { editorId: string }) {
  /** Must match `PlateStoreProvider` scope (`editor.id`) and `PlateContent id={…}` — unscoped `useEditorRef()` can resolve the fallback editor. */
  const editor = useEditorRef(editorId) as PlateEditor;

  /** Workspace packages can resolve a second `@platejs/core` peer; runtime is fine. */
  const slate = editor as any;

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <FixedToolbar className="flex-wrap justify-start gap-0 p-1">
      <ToolbarGroup>
        <ToolbarButton tooltip="Paragraph" onMouseDown={run(() => setBlockType(editor, KEYS.p))}>
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Heading 1" onMouseDown={run(() => setBlockType(editor, KEYS.h1))}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Heading 2" onMouseDown={run(() => setBlockType(editor, KEYS.h2))}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Heading 3" onMouseDown={run(() => setBlockType(editor, KEYS.h3))}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Bold" onMouseDown={run(() => editor.tf.toggleMark(KEYS.bold))}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Italic" onMouseDown={run(() => editor.tf.toggleMark(KEYS.italic))}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Underline" onMouseDown={run(() => editor.tf.toggleMark(KEYS.underline))}>
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Strikethrough"
          onMouseDown={run(() => editor.tf.toggleMark(KEYS.strikethrough))}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Code" onMouseDown={run(() => editor.tf.toggleMark(KEYS.code))}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Align left" onMouseDown={run(() => setAlign(slate, 'left'))}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Align center" onMouseDown={run(() => setAlign(slate, 'center'))}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Align right" onMouseDown={run(() => setAlign(slate, 'right'))}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Blockquote" onMouseDown={run(() => setBlockType(editor, KEYS.blockquote))}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Link"
          onMouseDown={run(() => {
            const raw = window.prompt('Link URL (https://…)');
            if (raw == null) return;
            const url = raw.trim();
            if (!url) return;
            upsertLink(slate, { url });
          })}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Image from URL"
          onMouseDown={run(() => {
            const raw = window.prompt('Image URL (https://…)');
            if (raw == null) return;
            const url = raw.trim();
            if (!url) return;
            insertImage(slate, url);
          })}
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton
          tooltip="Bulleted list"
          onMouseDown={run(() =>
            toggleList(slate, {
              listStyleType: ListStyleType.Disc,
            }),
          )}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Numbered list"
          onMouseDown={run(() =>
            toggleList(slate, {
              listStyleType: ListStyleType.Decimal,
            }),
          )}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Indent" onMouseDown={run(() => indent(slate))}>
          <IndentIncrease className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Outdent" onMouseDown={run(() => outdent(slate))}>
          <IndentDecrease className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton
          tooltip="Table (3×3)"
          onMouseDown={run(() =>
            insertTable(slate, {
              rowCount: 3,
              colCount: 3,
              header: true,
            }),
          )}
        >
          <Table2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Code block" onMouseDown={run(() => toggleCodeBlock(slate))}>
          <Braces className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Block equation" onMouseDown={run(() => insertEquation(slate))}>
          <Sigma className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Inline equation"
          onMouseDown={run(() => {
            const tex = window.prompt('TeX (inline)', 'x^2');
            if (tex == null) return;
            insertInlineEquation(slate, tex);
          })}
        >
          <span className="font-mono text-xs">∑</span>
        </ToolbarButton>
      </ToolbarGroup>
      {completionApi ? (
        <>
          <ToolbarSeparator className="mx-0.5" />
          <ToolbarGroup>
            <ToolbarButton
              tooltip="AI suggestion (Copilot)"
              onMouseDown={run(() => {
                void triggerCopilotSuggestion(editor as any);
              })}
            >
              <Sparkles className="h-4 w-4" />
            </ToolbarButton>
          </ToolbarGroup>
        </>
      ) : null}
    </FixedToolbar>
  );
}

function buildPlugins(readOnly: boolean) {
  const copilot =
    !readOnly && completionApi
      ? [
          CopilotPlugin.configure({
            options: {
              debounceDelay: 400,
              completeOptions: {
                api: completionApi,
              },
            },
          }),
        ]
      : [];

  return [
    ParagraphPlugin,
    BaseBasicMarksPlugin,
    BaseHeadingPlugin,
    BaseBasicBlocksPlugin,
    TextAlignPlugin,
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
    TablePlugin,
    CodeBlockPlugin,
    ImagePlugin,
    EquationPlugin,
    InlineEquationPlugin,
    MarkdownPlugin.configure({
      options: {
        remarkPlugins: [remarkMath, remarkGfm],
      },
    }),
    ...copilot,
    AutoformatPlugin.configure({
      options: {
        enableUndoOnDelete: true,
        rules: buildAutoformatRules(),
      },
    }),
  ];
}

export interface PlateMarkdownDocumentEditorProps {
  /** Markdown from the server; only applied on mount when parent remounts via `key`. */
  initialMarkdown: string;
  onMarkdownChange: (markdown: string) => void;
  className?: string;
  readOnly?: boolean;
}

export function PlateMarkdownDocumentEditor({
  initialMarkdown,
  onMarkdownChange,
  className,
  readOnly,
}: PlateMarkdownDocumentEditorProps) {
  const plugins = useMemo(() => buildPlugins(!!readOnly), [readOnly]);

  const initialValue = useMemo(() => {
    const e = createPlateEditor({ plugins });
    try {
      const raw = deserializeMd(e as any, initialMarkdown ?? '');
      return ensureNonEmptyValue(raw as Value);
    } catch {
      return ensureNonEmptyValue(undefined);
    }
  }, [plugins, initialMarkdown]);

  const editor = usePlateEditor({
    plugins,
    value: initialValue,
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('flex min-h-0 flex-col rounded-md border border-input bg-background', className)}>
      <Plate
        editor={editor}
        readOnly={readOnly}
        onValueChange={() => {
          const md = serializeMd(editor as any);
          onMarkdownChange(md);
        }}
      >
        {/*
          Toolbar must live outside Slate's <Slate> children (not beforeEditable):
          as siblings inside Plate, with shrink-0 + flex column, so it stays visible
          above the editable and is not clipped or collapsed by scroll/layout.
          PlateEditorIdProvider matches PlateContent id so hooks in toolbar match the store.
        */}
        <PlateEditorIdProvider id={editor.id}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {!readOnly ? (
              <div className="shrink-0">
                <RadixTooltip.Provider delayDuration={0}>
                  <FullDocumentToolbar editorId={editor.id} />
                </RadixTooltip.Provider>
              </div>
            ) : null}
            <PlateContent
              id={editor.id}
              className={cn(
                'min-h-0 min-w-0 flex-1',
                'prose prose-sm dark:prose-invert min-h-[280px] max-w-none px-4 py-3 outline-none focus:outline-none',
                'prose-a:text-primary prose-a:underline',
                'prose-table:border prose-th:border prose-td:border',
              )}
              placeholder={readOnly ? undefined : 'Write… Markdown is saved as the document body.'}
            />
          </div>
        </PlateEditorIdProvider>
      </Plate>
    </div>
  );
}

export default PlateMarkdownDocumentEditor;
