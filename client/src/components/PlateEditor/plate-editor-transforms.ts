import type { PlateEditor } from 'platejs/react';
import type { NodeEntry, TElement } from 'platejs';
import { KEYS } from 'platejs';

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
