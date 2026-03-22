import { CODE_DRAWING_KEY } from '@platejs/code-drawing';
import type { Descendant, TText } from 'platejs';
import { ElementApi, KEYS, TextApi } from 'platejs';
import type { PlateEditor } from 'platejs/react';

/** Same inner capture as server `WIKILINK_RE` (title segment only). */
const WIKILINK_IN_TEXT =
  /\[\[([^\]|#]+)(#[^\]]*)?(\|[^\]]*)?\]\]/g;

function skipElementSubtree(editor: PlateEditor, type: string): boolean {
  const t = [
    KEYS.codeBlock,
    KEYS.codeLine,
    CODE_DRAWING_KEY,
    KEYS.table,
    KEYS.td,
    KEYS.th,
  ];
  return t.some((k) => type === editor.getType(k));
}

/**
 * Turn plain-text `[[Title]]` spans into mention voids when `resolveDocumentId(title)` hits.
 * Skips code blocks / tables so fenced Mermaid stays verbatim.
 */
export function applyWikilinkPlainTextToMentions(
  editor: PlateEditor,
  nodes: Descendant[],
  resolveDocumentId: (wikilinkTitle: string) => string | null,
): Descendant[] {
  const mentionType = editor.getType(KEYS.mention);

  const walk = (list: Descendant[]): Descendant[] =>
    list.flatMap((node) => {
      if (TextApi.isText(node)) {
        return splitTextNodeToMentions(node, mentionType, resolveDocumentId);
      }
      if (ElementApi.isElement(node)) {
        if (skipElementSubtree(editor, node.type)) {
          return [node];
        }
        if (node.children?.length) {
          return [{ ...node, children: walk(node.children) }];
        }
      }
      return [node];
    });

  return walk(nodes);
}

function splitTextNodeToMentions(
  text: TText,
  mentionType: string,
  resolveDocumentId: (title: string) => string | null,
): Descendant[] {
  const s = text.text;
  if (!s.includes('[[')) return [text];

  const out: Descendant[] = [];
  let last = 0;
  const re = new RegExp(WIKILINK_IN_TEXT.source, 'g');
  let m: RegExpExecArray | null;

  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      out.push({ ...text, text: s.slice(last, m.index) });
    }
    const titleKey = (m[1] ?? '').trim();
    const id = titleKey ? resolveDocumentId(titleKey) : null;
    const displayInner = m[0].slice(2, -2).trim();

    if (id) {
      out.push({
        type: mentionType,
        key: id,
        value: displayInner || titleKey,
        children: [{ text: '' }],
      } as Descendant);
    } else {
      out.push({ ...text, text: m[0] });
    }
    last = m.index + m[0].length;
  }

  if (last < s.length) {
    out.push({ ...text, text: s.slice(last) });
  }

  if (out.length === 0) {
    return [{ ...text, text: '' }];
  }

  return mergeAdjacentTextLeaves(out);
}

function mergeAdjacentTextLeaves(nodes: Descendant[]): Descendant[] {
  const merged: Descendant[] = [];
  for (const n of nodes) {
    if (!TextApi.isText(n)) {
      merged.push(n);
      continue;
    }
    const prev = merged[merged.length - 1];
    if (prev && TextApi.isText(prev)) {
      merged[merged.length - 1] = { ...prev, text: prev.text + n.text } as TText;
    } else {
      merged.push(n);
    }
  }
  return merged;
}
