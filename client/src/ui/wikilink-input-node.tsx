'use client';

import * as React from 'react';

import type { SlateEditor, TComboboxInputElement } from 'platejs';
import { KEYS, NodeApi, TextApi, getEditorPlugin } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { PlateElement } from 'platejs/react';

import { useDocumentLinkPicker } from '@/context/DocumentLinkPickerContext';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from './inline-combobox';
import { type MentionComboItem, PLATE_LINK_PICKER_DEMO_ITEMS } from './mention-node';

/** Avoid breaking wikilink / Obsidian `[[...]]` syntax in saved markdown. */
function safeWikilinkTitle(displayTitle: string): string {
  const t = displayTitle.replace(/\]/g, '').trim();
  return t.length > 0 ? t : 'Untitled';
}

function insertWikilinkFromCombobox(
  editor: SlateEditor,
  element: TComboboxInputElement,
  item: MentionComboItem,
) {
  const voidPath = editor.api.findPath(element);
  if (!voidPath) return;

  const displayTitle = safeWikilinkTitle(item.text);

  const end = editor.api.after(voidPath);
  if (!end) return;

  let anchor = editor.api.before(voidPath);
  if (!anchor) return;

  const lastIdx = voidPath[voidPath.length - 1]!;
  if (typeof lastIdx === 'number' && lastIdx >= 1) {
    const prevPath = [...voidPath.slice(0, -1), lastIdx - 1];
    const prevNode = NodeApi.get(editor, prevPath);
    if (TextApi.isText(prevNode) && prevNode.text.endsWith('[')) {
      anchor = { path: prevPath, offset: prevNode.text.length - 1 };
    }
  }

  editor.tf.delete({ at: { anchor, focus: end } });
  editor.tf.select({ anchor, focus: anchor });

  const { tf: mentionTf, getOptions } = getEditorPlugin(editor, { key: KEYS.mention });
  mentionTf.insert.mention({ key: item.key, value: displayTitle });

  editor.tf.move({ unit: 'offset' });

  const pathAbove = editor.api.block()?.[1];
  const isBlockEnd =
    editor.selection &&
    pathAbove &&
    editor.api.isEnd(editor.selection.anchor, pathAbove);

  if (isBlockEnd && getOptions().insertSpaceAfterMention) {
    editor.tf.insertText(' ');
  }

  editor.tf.focus();
}

export function WikilinkInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');
  const linkPicker = useDocumentLinkPicker();

  React.useEffect(() => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const next = search.replace(/\]/g, '');
    const cur = (element as { data?: { wikilinkQ?: string } }).data?.wikilinkQ ?? '';
    if (cur === next) return;
    editor.tf.setNodes({ data: { ...((element as any).data ?? {}), wikilinkQ: next } }, { at: path });
  }, [search, editor, element]);

  const items = React.useMemo((): MentionComboItem[] => {
    if (!linkPicker) {
      return PLATE_LINK_PICKER_DEMO_ITEMS;
    }
    return linkPicker.documents
      .filter((d) => d.id !== linkPicker.currentDocumentId)
      .map((d) => {
        const text = d.title?.trim() || 'Untitled';
        return {
          key: d.id,
          text,
          keywords: [text, d.id],
        };
      });
  }, [linkPicker]);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={element}
        setValue={setSearch}
        showTrigger
        trigger="["
      >
        <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2">
          <InlineComboboxInput />
        </span>

        <InlineComboboxContent className="my-1.5">
          <InlineComboboxEmpty>
            {linkPicker ? 'No matching notes' : 'No results'}
          </InlineComboboxEmpty>

          <InlineComboboxGroup>
            {items.map((item) => (
              <InlineComboboxItem
                key={item.key}
                value={item.key}
                label={item.text}
                keywords={item.keywords}
                skipRemoveInput
                onClick={() => insertWikilinkFromCombobox(editor, element, item)}
              >
                {item.text}
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
