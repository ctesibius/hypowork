'use client';

import React, { useMemo, useCallback } from 'react';
import { Plate, PlateContent, createPlateEditor, usePlateEditor, ParagraphPlugin } from '@platejs/core/react';
import {
  BaseBasicMarksPlugin,
  BaseHeadingPlugin,
  BaseBasicBlocksPlugin,
} from '@platejs/basic-nodes';
import { AutoformatPlugin, autoformatArrow, autoformatLegal, autoformatLegalHtml, autoformatMath, autoformatPunctuation, autoformatSmartQuotes } from '@platejs/autoformat';
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
import { SlashPlugin, SlashInputPlugin } from '@platejs/slash-command/react';
import { CodeDrawingPlugin } from '@platejs/code-drawing/react';
import { KEYS } from 'platejs';
import type { Value } from 'platejs';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { ToolbarButton, ToolbarGroup, ToolbarSeparator } from '@udecode/toolbar';
import { CodeDrawingElement } from '@/ui/code-drawing-node';
import {
  Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Heading3,
  Pilcrow, List, ListOrdered, IndentIncrease, IndentDecrease, Link2,
  Table2, Braces, AlignLeft, AlignCenter, AlignRight, Quote
} from 'lucide-react';
import { setBlockType } from './PlateEditor/plate-editor-transforms';

/** Ensure editor always has a non-empty value so Plate renders properly */
function ensureNonEmptyValue(v: Value | undefined): Value {
  if (Array.isArray(v) && v.length > 0) return v;
  return [{ type: 'p', children: [{ text: '' }] }];
}

function buildAutoformatRules() {
  return [
    ...autoformatSmartQuotes,
    ...autoformatPunctuation,
    ...autoformatLegal,
    ...autoformatLegalHtml,
    ...autoformatArrow,
    ...autoformatMath,
  ];
}

function DocumentToolbar({ editor }: { editor: any }) {
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
        <ToolbarButton tooltip="Strikethrough" onMouseDown={run(() => editor.tf.toggleMark(KEYS.strikethrough))}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Code" onMouseDown={run(() => editor.tf.toggleMark(KEYS.code))}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Align left" onMouseDown={run(() => setAlign(editor, 'left'))}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Align center" onMouseDown={run(() => setAlign(editor, 'center'))}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Align right" onMouseDown={run(() => setAlign(editor, 'right'))}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Blockquote" onMouseDown={run(() => setBlockType(editor, KEYS.blockquote))}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Link" onMouseDown={run(() => {
          const url = window.prompt('Link URL');
          if (url) upsertLink(editor, { url });
        })}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Bulleted list" onMouseDown={run(() => toggleList(editor, { listStyleType: ListStyleType.Disc }))}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Numbered list" onMouseDown={run(() => toggleList(editor, { listStyleType: ListStyleType.Decimal }))}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Indent" onMouseDown={run(() => indent(editor))}>
          <IndentIncrease className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Outdent" onMouseDown={run(() => outdent(editor))}>
          <IndentDecrease className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator className="mx-0.5" />
      <ToolbarGroup>
        <ToolbarButton tooltip="Table" onMouseDown={run(() => insertTable(editor, { rowCount: 3, colCount: 3, header: true }))}>
          <Table2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Code block" onMouseDown={run(() => toggleCodeBlock(editor))}>
          <Braces className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>
    </FixedToolbar>
  );
}

export interface PlateMarkdownEditorProps {
  initialMarkdown: string;
  onMarkdownChange: (markdown: string) => void;
  className?: string;
  readOnly?: boolean;
}

export function PlateMarkdownEditor({
  initialMarkdown,
  onMarkdownChange,
  className,
  readOnly,
}: PlateMarkdownEditorProps) {
  const plugins = useMemo(
    () => [
      ParagraphPlugin,
      BaseBasicMarksPlugin,
      BaseHeadingPlugin,
      BaseBasicBlocksPlugin,
      TextAlignPlugin,
      LinkPlugin,
      IndentPlugin.configure({ inject: { targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote] } }),
      ListPlugin.configure({ inject: { targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote] } }),
      TablePlugin,
      CodeBlockPlugin,
      ImagePlugin,
      EquationPlugin,
      InlineEquationPlugin,
      MarkdownPlugin.configure({ options: { remarkPlugins: [remarkGfm] } }),
      AutoformatPlugin.configure({ options: { rules: buildAutoformatRules() } }),
      SlashPlugin,
      SlashInputPlugin,
      // CodeDrawing plugin with component
      CodeDrawingPlugin.withComponent(CodeDrawingElement),
    ],
    []
  );

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

  const handleValueChange = useCallback(() => {
    if (!editor) return;
    try {
      const md = serializeMd(editor as any);
      onMarkdownChange(md);
    } catch {
      // ignore serialization errors
    }
  }, [editor, onMarkdownChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('flex min-h-0 flex-col rounded-md border border-input bg-background', className)}>
      <Plate editor={editor} onValueChange={handleValueChange}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!readOnly && (
            <div className="shrink-0">
              <DocumentToolbar editor={editor} />
            </div>
          )}
          <div className="min-h-[300px] w-full">
            <PlateContent
              className="min-h-[300px] px-4 py-3 outline-none focus:outline-none"
              placeholder={readOnly ? undefined : 'Start writing... (type / for commands)'}
            />
          </div>
        </div>
      </Plate>
    </div>
  );
}

export default PlateMarkdownEditor;
