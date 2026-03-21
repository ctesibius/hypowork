'use client';

import type { PlateEditor } from 'platejs/react';

import { insertCallout } from '@platejs/callout';
import { insertCodeBlock, toggleCodeBlock } from '@platejs/code-block';
import type { CodeDrawingType } from '@platejs/code-drawing';
import { insertCodeDrawing } from '@platejs/code-drawing';
import { insertDate } from '@platejs/date';
import { insertExcalidraw } from '@platejs/excalidraw';
import { insertColumnGroup, toggleColumnGroup } from '@platejs/layout';
import { triggerFloatingLink } from '@platejs/link/react';
import { insertEquation, insertInlineEquation } from '@platejs/math';
import {
  insertAudioPlaceholder,
  insertFilePlaceholder,
  insertMedia,
  insertVideoPlaceholder,
} from '@platejs/media';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { TablePlugin } from '@platejs/table/react';
import { insertToc } from '@platejs/toc';
import {
  type NodeEntry,
  type Path,
  type TElement,
  type TText,
  KEYS,
  PathApi,
} from 'platejs';

const ACTION_THREE_COLUMNS = 'action_three_columns';

const insertList = (editor: PlateEditor, type: string) => {
  editor.tf.insertNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    { select: true }
  );
};

const insertBlockMap: Record<
  string,
  (editor: PlateEditor, type: string) => void
> = {
  [KEYS.listTodo]: insertList,
  [KEYS.ol]: insertList,
  [KEYS.ul]: insertList,
  [ACTION_THREE_COLUMNS]: (editor) =>
    insertColumnGroup(editor, { columns: 3, select: true }),
  [KEYS.audio]: (editor) => insertAudioPlaceholder(editor, { select: true }),
  [KEYS.callout]: (editor) => insertCallout(editor, { select: true }),
  [KEYS.codeBlock]: (editor) => insertCodeBlock(editor, { select: true }),
  [KEYS.codeDrawing]: (editor) =>
    insertCodeDrawing(editor, {}, { select: true }),
  [KEYS.equation]: (editor) => insertEquation(editor, { select: true }),
  [KEYS.excalidraw]: (editor) => insertExcalidraw(editor, {}, { select: true }),
  [KEYS.file]: (editor) => insertFilePlaceholder(editor, { select: true }),
  [KEYS.img]: (editor) =>
    insertMedia(editor, {
      select: true,
      type: KEYS.img,
    }),
  [KEYS.mediaEmbed]: (editor) =>
    insertMedia(editor, {
      select: true,
      type: KEYS.mediaEmbed,
    }),
  [KEYS.table]: (editor) =>
    editor.getTransforms(TablePlugin).insert.table({}, { select: true }),
  [KEYS.toc]: (editor) => insertToc(editor, { select: true }),
  [KEYS.video]: (editor) => insertVideoPlaceholder(editor, { select: true }),
};

const insertInlineMap: Record<
  string,
  (editor: PlateEditor, type: string) => void
> = {
  [KEYS.date]: (editor) => insertDate(editor, { select: true }),
  [KEYS.inlineEquation]: (editor) =>
    insertInlineEquation(editor, '', { select: true }),
  [KEYS.link]: (editor) => triggerFloatingLink(editor, { focused: true }),
};

type InsertBlockOptions = {
  upsert?: boolean;
};

export const insertBlock = (
  editor: PlateEditor,
  type: string,
  options: InsertBlockOptions = {}
) => {
  const { upsert = false } = options;

  editor.tf.withoutNormalizing(() => {
    const block = editor.api.block();

    if (!block) return;

    const [currentNode, path] = block;
    const isCurrentBlockEmpty = editor.api.isEmpty(currentNode);
    const currentBlockType = getBlockType(currentNode);

    const isSameBlockType = type === currentBlockType;

    if (upsert && isCurrentBlockEmpty && isSameBlockType) {
      return;
    }

    if (type in insertBlockMap) {
      insertBlockMap[type](editor, type);
    } else {
      editor.tf.insertNodes(editor.api.create.block({ type }), {
        at: PathApi.next(path),
        select: true,
      });
    }

    if (!isSameBlockType) {
      editor.getApi(SuggestionPlugin).suggestion.withoutSuggestions(() => {
        editor.tf.removeNodes({ previousEmptyBlock: true });
      });
    }
  });
};

export const insertInlineElement = (editor: PlateEditor, type: string) => {
  if (insertInlineMap[type]) {
    insertInlineMap[type](editor, type);
  }
};

const setList = (
  editor: PlateEditor,
  type: string,
  entry: NodeEntry<TElement>
) => {
  editor.tf.setNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    {
      at: entry[1],
    }
  );
};

/** Map fenced code `lang` to code-drawing renderer (Turn into → Code Drawing). */
function mapCodeBlockLangToDrawingType(lang: string | undefined): CodeDrawingType {
  const l = (lang ?? '').toLowerCase();
  if (l.includes('mermaid')) return 'Mermaid';
  if (l.includes('plant') || l === 'puml') return 'PlantUml';
  if (l.includes('graphviz') || l === 'dot') return 'Graphviz';
  if (l.includes('flow')) return 'Flowchart';
  return 'Mermaid';
}

/** Same line join as markdown `code_block` serialize — preserves Mermaid/newlines (unlike `editor.api.string`). */
function codeBlockPlainText(editor: PlateEditor, node: TElement): string {
  const codeBlockType = editor.getType(KEYS.codeBlock);
  if (node.type !== codeBlockType) return '';
  return node.children
    .map((line) => {
      const el = line as TElement;
      if (!el.children?.length) return '';
      return el.children
        .map((c) => (c as TText).text ?? '')
        .join('');
    })
    .join('\n');
}

function textForCodeDrawingBlock(editor: PlateEditor, node: TElement): string {
  const codeDrawingType = editor.getType(KEYS.codeDrawing);
  if (node.type === codeDrawingType) {
    return (node as { data?: { code?: string } }).data?.code ?? '';
  }
  if (node.type === editor.getType(KEYS.codeBlock)) {
    return codeBlockPlainText(editor, node);
  }
  return editor.api.string(node);
}

const setCodeDrawing = (
  editor: PlateEditor,
  _type: string,
  entry: NodeEntry<TElement>
) => {
  const [node, path] = entry;
  const codeDrawingType = editor.getType(KEYS.codeDrawing);
  if (node.type === codeDrawingType) return;

  const code = textForCodeDrawingBlock(editor, node);
  const lang =
    node.type === editor.getType(KEYS.codeBlock)
      ? (node as { lang?: string }).lang
      : undefined;
  const drawingType = mapCodeBlockLangToDrawingType(lang);

  editor.tf.setNodes(
    {
      type: codeDrawingType,
      children: [{ text: '' }],
      data: {
        code,
        drawingType,
        drawingMode: 'Both',
      },
    },
    { at: path }
  );
};

const setBlockMap: Record<
  string,
  (editor: PlateEditor, type: string, entry: NodeEntry<TElement>) => void
> = {
  [KEYS.listTodo]: setList,
  [KEYS.ol]: setList,
  [KEYS.ul]: setList,
  [ACTION_THREE_COLUMNS]: (editor) => toggleColumnGroup(editor, { columns: 3 }),
  [KEYS.codeBlock]: (editor) => toggleCodeBlock(editor),
  [KEYS.codeDrawing]: setCodeDrawing,
};

export const setBlockType = (
  editor: PlateEditor,
  type: string,
  { at }: { at?: Path } = {}
) => {
  editor.tf.withoutNormalizing(() => {
    const setEntry = (entry: NodeEntry<TElement>) => {
      const [node, path] = entry;

      if (node[KEYS.listType]) {
        editor.tf.unsetNodes([KEYS.listType, 'indent'], { at: path });
      }
      if (type in setBlockMap) {
        return setBlockMap[type](editor, type, entry);
      }
      if (node.type !== type) {
        editor.tf.setNodes({ type }, { at: path });
      }
    };

    if (at) {
      const entry = editor.api.node<TElement>(at);

      if (entry) {
        setEntry(entry);

        return;
      }
    }

    const entries = editor.api.blocks({ mode: 'lowest' });

    entries.forEach((entry) => {
      setEntry(entry);
    });
  });
};

export const getBlockType = (block: TElement) => {
  if (block[KEYS.listType]) {
    if (block[KEYS.listType] === KEYS.ol) {
      return KEYS.ol;
    }
    if (block[KEYS.listType] === KEYS.listTodo) {
      return KEYS.listTodo;
    }
    return KEYS.ul;
  }

  return block.type;
};
