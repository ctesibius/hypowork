'use client';

import { withTriggerCombobox } from '@platejs/combobox';
import { createSlatePlugin, createTSlatePlugin, KEYS } from 'platejs';
import type { SlateEditor } from 'platejs';
import { toPlatePlugin } from 'platejs/react';

import { WikilinkInputElement } from '@/ui/wikilink-input-node';

export const WIKILINK_INPUT_KEY = 'wikilink_input' as const;

const BaseWikilinkInputPlugin = createSlatePlugin({
  key: WIKILINK_INPUT_KEY,
  editOnly: true,
  node: { isElement: true, isInline: true, isVoid: true },
});

export const WikilinkInputPlugin = toPlatePlugin(BaseWikilinkInputPlugin);

const BaseWikilinkComboboxPlugin = createTSlatePlugin({
  key: 'wikilink_combobox',
  editOnly: true,
  options: {
    trigger: '[',
    triggerPreviousCharPattern: /^\[$/,
    triggerQuery: (editor: SlateEditor) =>
      !editor.api.some({
        match: { type: editor.getType(KEYS.codeBlock) },
      }),
    createComboboxInput: () => ({
      children: [{ text: '' }],
      trigger: '[[',
      type: WIKILINK_INPUT_KEY,
    }),
  },
  plugins: [BaseWikilinkInputPlugin],
}).overrideEditor(withTriggerCombobox as any);

export const WikilinkComboboxPlugin = BaseWikilinkComboboxPlugin;

/** Opens after typing `[[` (second `[`); inserts `[[note title]]` for `document_links` wikilink parsing. */
export const WikilinkComboboxKit = [
  WikilinkComboboxPlugin,
  WikilinkInputPlugin.withComponent(WikilinkInputElement),
];
