'use client';

import type { CodeDrawingType } from '@platejs/code-drawing';
import {
  MarkdownPlugin,
  defaultRules,
  remarkMdx,
  remarkMention,
  type SerializeMdOptions,
} from '@platejs/markdown';
import { KEYS, getPluginType } from 'platejs';
import type { TMentionElement } from 'platejs';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { WIKILINK_INPUT_KEY } from './wikilink-combobox-kit';

/** Matches server `document-link-support` UUID detection — serialize as `[[title]]` (title resolved like wikilinks). */
const STANDALONE_DOC_MENTION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function docMentionWikilinkTitle(node: TMentionElement): string {
  const label = String(node.value ?? '')
    .replace(/\]/g, '')
    .trim();
  return label.length > 0 ? label : 'Untitled';
}

const baseMentionRule = defaultRules.mention;
const baseMentionSerialize = baseMentionRule?.serialize;

const baseCodeBlockRule = defaultRules.code_block;
const baseCodeBlockDeserialize = baseCodeBlockRule?.deserialize;
const baseCodeBlockSerialize = baseCodeBlockRule?.serialize;

/**
 * Fenced-code language for persisted code-drawing blocks.
 * Plain ```mermaid etc. stay normal code blocks; only this prefix round-trips as code_drawing.
 */
const DRAWING_FENCE_PREFIX = 'paperclip-drawing';

function parseDrawingFenceLang(lang: string | null | undefined): {
  drawingType: CodeDrawingType;
  drawingMode: string;
} | null {
  if (!lang?.startsWith(DRAWING_FENCE_PREFIX)) return null;
  const rest = lang.slice(DRAWING_FENCE_PREFIX.length).replace(/^\/+/, '');
  const [typePart, modePart] = rest.split('/');
  const drawingType = (typePart || 'Mermaid') as CodeDrawingType;
  const drawingMode = modePart || 'Both';
  return { drawingType, drawingMode };
}

function formatDrawingFenceLang(drawingType: string, drawingMode: string): string {
  return `${DRAWING_FENCE_PREFIX}/${drawingType}/${drawingMode}`;
}

const mentionRules =
  baseMentionRule && baseMentionSerialize
    ? {
        mention: {
          ...baseMentionRule,
          serialize: (node: TMentionElement, options: SerializeMdOptions) => {
            const mentionId = String(node.key ?? node.value ?? '').trim();
            if (STANDALONE_DOC_MENTION_UUID.test(mentionId)) {
              return {
                type: 'text',
                value: `[[${docMentionWikilinkTitle(node)}]]`,
              };
            }
            return baseMentionSerialize(node, options);
          },
        },
      }
    : {};

const codeBlockRules =
  baseCodeBlockRule && baseCodeBlockDeserialize && baseCodeBlockSerialize
    ? {
        code_block: {
          ...baseCodeBlockRule,
          deserialize: (mdastNode: Parameters<typeof baseCodeBlockDeserialize>[0], deco: any, options: any) => {
            const parsed = parseDrawingFenceLang(mdastNode.lang);
            if (parsed && options.editor) {
              return {
                type: getPluginType(options.editor, KEYS.codeDrawing),
                children: [{ text: '' }],
                data: {
                  code: mdastNode.value ?? '',
                  drawingType: parsed.drawingType,
                  drawingMode: parsed.drawingMode,
                },
              };
            }
            return baseCodeBlockDeserialize(mdastNode, deco, options);
          },
        },
      }
    : {};

/**
 * Slate → mdast uses getPluginKey(editor, node.type). Code drawing nodes key as `code_drawing`,
 * not `code_block`, so serialization must live here or the block is dropped (unreachable).
 */
const codeDrawingRules = {
  code_drawing: {
    serialize: (node: any, _options: SerializeMdOptions) => {
      const d = node.data ?? {};
      return {
        type: 'code',
        lang: formatDrawingFenceLang(
          String(d.drawingType ?? 'Mermaid'),
          String(d.drawingMode ?? 'Both'),
        ),
        value: String(d.code ?? ''),
      };
    },
  },
};

/** Leading `[` lives in the previous text node; this emits the second `[` plus the filter query for `[[…` in saved markdown. */
const wikilinkInputRules = {
  [WIKILINK_INPUT_KEY]: {
    serialize: (node: { data?: { wikilinkQ?: string } }, _options: SerializeMdOptions) => {
      const q = String(node.data?.wikilinkQ ?? '').replace(/\]/g, '');
      return { type: 'text', value: `[${q}` };
    },
  },
};

const markdownCustomRules = {
  ...codeDrawingRules,
  ...codeBlockRules,
  ...wikilinkInputRules,
  ...mentionRules,
};

export const MarkdownKit = [
  MarkdownPlugin.configure({
    options: {
      plainMarks: [KEYS.suggestion, KEYS.comment],
      /** UI-only / streaming nodes: omit from MD so serializeMd does not hit unreachable(). */
      disallowedNodes: [KEYS.aiChat, KEYS.slashInput],
      remarkPlugins: [remarkMath, remarkGfm, remarkMdx, remarkMention],
      ...(Object.keys(markdownCustomRules).length > 0 && { rules: markdownCustomRules }),
    } as any,
  }),
];
