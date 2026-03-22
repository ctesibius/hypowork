'use client';

import 'katex/dist/katex.min.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plate, createPlateEditor, usePlateEditor } from '@platejs/core/react';
import { deserializeMd, serializeMd } from '@platejs/markdown';
import type { Value } from 'platejs';

import { plugins as fullKitPlugins } from '@/plate-markdown/plugins';
import { Editor, EditorContainer } from '@/ui/editor';
import { cn } from '@/lib/utils';
import { OutlineScrollThumb } from '@/components/PlateEditor/outline-scroll-thumb';

function ensureNonEmptyValue(v: Value | undefined): Value {
  if (Array.isArray(v) && v.length > 0) return v;
  return [{ type: 'p', children: [{ text: '' }] }];
}

export interface PlateFullKitMarkdownDocumentEditorProps {
  /** Stable document id — bootstrap markdown only changes when this or reloadNonce changes. */
  documentId: string;
  /** Increment after a conflict reload so we re-deserialize from server markdown. */
  reloadNonce?: number;
  /** Markdown used to bootstrap the editor (typically parent `body`); not reapplied on every prop change. */
  initialMarkdown: string;
  onMarkdownChange: (markdown: string) => void;
  className?: string;
  readOnly?: boolean;
  /** Edge-to-edge in `<main>`: no card border/radius; fills height with internal scroll. */
  fullBleed?: boolean;
  /** Overrides default placeholder (e.g. hint for @ document links). */
  editorPlaceholder?: string;
}

/**
 * Same plugin stack as `/plate-markdown-test`. Bootstraps from markdown once per document / reload
 * so autosave + revision bumps do not reset Slate (preserves non-MD nodes like code drawing).
 */
export function PlateFullKitMarkdownDocumentEditor({
  documentId,
  reloadNonce = 0,
  initialMarkdown,
  onMarkdownChange,
  className,
  readOnly,
  fullBleed = false,
  editorPlaceholder,
}: PlateFullKitMarkdownDocumentEditorProps) {
  const editorCardRef = useRef<HTMLDivElement>(null);
  const plugins = fullKitPlugins;

  const bootstrapRef = useRef({ documentId, reloadNonce });
  const [bootstrapMd, setBootstrapMd] = useState(initialMarkdown);

  useEffect(() => {
    const prev = bootstrapRef.current;
    const docChanged = documentId !== prev.documentId;
    const reload = reloadNonce !== prev.reloadNonce;
    if (docChanged || reload) {
      bootstrapRef.current = { documentId, reloadNonce };
      setBootstrapMd(initialMarkdown);
    }
  }, [documentId, reloadNonce, initialMarkdown]);

  const initialValue = useMemo(() => {
    const e = createPlateEditor({ plugins });
    try {
      const raw = deserializeMd(e as never, bootstrapMd ?? '');
      return ensureNonEmptyValue(raw as Value);
    } catch {
      return ensureNonEmptyValue(undefined);
    }
  }, [plugins, bootstrapMd]);

  const editor = usePlateEditor({
    plugins,
    value: initialValue,
  });

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        fullBleed ? 'h-full flex-1 rounded-none border-0 bg-transparent' : 'rounded-md border border-input bg-background',
        className,
      )}
    >
      <Plate
        editor={editor}
        readOnly={readOnly}
        onValueChange={() => {
          try {
            const md = serializeMd(editor as never);
            onMarkdownChange(md);
          } catch {
            // ignore serialization errors during partial updates
          }
        }}
      >
        <div className={cn('flex gap-4', fullBleed && 'min-h-0 flex-1 flex-col')}>
          <div
            ref={editorCardRef}
            className={cn(
              'relative min-w-0 flex-1 overflow-visible',
              fullBleed ? 'min-h-0 flex-1 rounded-none border-0 bg-transparent' : 'rounded-lg border border-border/60 bg-card/30',
            )}
          >
            <EditorContainer
              className={cn(fullBleed ? 'h-full! min-h-0 flex-1' : 'min-h-[400px]')}
              variant={fullBleed ? 'document' : 'demo'}
            >
              <Editor
                variant={fullBleed ? 'document' : 'demo'}
                placeholder={
                  readOnly
                    ? undefined
                    : (editorPlaceholder ?? 'Write… Markdown is saved as the document body.')
                }
                spellCheck={false}
                disabled={readOnly}
              />
            </EditorContainer>
            {!readOnly ? (
              <OutlineScrollThumb anchorRef={editorCardRef} position="sticky" />
            ) : null}
          </div>
        </div>
      </Plate>
    </div>
  );
}

export default PlateFullKitMarkdownDocumentEditor;
