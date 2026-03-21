'use client';

import * as React from 'react';

import type { TComboboxInputElement } from 'platejs';
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

export function WikilinkInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');
  const linkPicker = useDocumentLinkPicker();

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
                onClick={() => {
                  const inner = safeWikilinkTitle(item.text);
                  editor.tf.insertText(`[${inner}]]`);
                }}
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
