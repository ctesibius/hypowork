'use client';

import 'katex/dist/katex.min.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plate, createPlateEditor, usePlateEditor } from '@platejs/core/react';
import { CopilotPlugin } from '@platejs/ai/react';
import { deserializeMd, serializeMd } from '@platejs/markdown';
import type { Value } from 'platejs';
import type { PlateEditor } from 'platejs/react';

import { aiChatPlugin } from '@/kits/plugins/ai-kit';
import { plugins as fullKitPlugins } from '@/plate-markdown/plugins';
import { applyWikilinkPlainTextToMentions } from '@/lib/applyWikilinkPlainTextToMentions';
import { Editor, EditorContainer } from '@/ui/editor';
import { cn } from '@/lib/utils';
import { OutlineScrollThumb } from '@/components/PlateEditor/outline-scroll-thumb';
import { normalizeMarkdownWikilinksForPersistence } from '@/lib/normalizeMarkdownWikilinksForPersistence';

function ensureNonEmptyValue(v: Value | undefined): Value {
  if (Array.isArray(v) && v.length > 0) return v;
  return [{ type: 'p', children: [{ text: '' }] }];
}

export interface PlateFullKitMarkdownDocumentEditorProps {
  /** Company scope for backend AI endpoints (`/api/companies/:companyId/...`). */
  companyId?: string;
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
  /**
   * When set, plain `[[Title]]` in loaded markdown becomes the same mention chip as `@` picks
   * (resolved by exact title match among company notes).
   */
  wikilinkMentionResolveDocumentId?: (wikilinkTitle: string) => string | null;
  /**
   * `canvasCard`: read-only compact preview for canvas doc nodes (matches Page kit, no outline thumb,
   * constrained height, no horizontal overflow on the card).
   */
  presentation?: 'default' | 'canvasCard';
  /** When `presentation="canvasCard"`, clamp Plate scroll to this height (px); omit for fit-content. */
  canvasCardBodyMaxHeightPx?: number;
  /** Hide the fixed toolbar (e.g. read-only preview panes next to the editor). */
  omitFixedToolbar?: boolean;
}

/**
 * Same plugin stack as `/plate-markdown-test`. Bootstraps from markdown once per document / reload
 * so autosave + revision bumps do not reset Slate (preserves non-MD nodes like code drawing).
 */
export function PlateFullKitMarkdownDocumentEditor({
  companyId,
  documentId,
  reloadNonce = 0,
  initialMarkdown,
  onMarkdownChange,
  className,
  readOnly,
  fullBleed = false,
  editorPlaceholder,
  wikilinkMentionResolveDocumentId,
  presentation = 'default',
  canvasCardBodyMaxHeightPx,
  omitFixedToolbar = false,
}: PlateFullKitMarkdownDocumentEditorProps) {
  const isCanvasCard = presentation === 'canvasCard';
  /** Canvas cards: hide fixed toolbar (viewing / editing / suggestion) — not useful on the board. */
  const plugins = useMemo(() => {
    if (!isCanvasCard && !omitFixedToolbar) return fullKitPlugins;
    return fullKitPlugins.filter((p) => (p as { key?: string }).key !== 'fixed-toolbar');
  }, [isCanvasCard, omitFixedToolbar]);
  /** Canvas card defaults to read-only; pass `readOnly={false}` to enable in-card edit (slash menu, etc.). */
  const effectiveReadOnly = isCanvasCard ? (readOnly ?? true) : Boolean(readOnly);
  const editorCardRef = useRef<HTMLDivElement>(null);

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
      let v = ensureNonEmptyValue(raw as Value);
      if (wikilinkMentionResolveDocumentId) {
        v = applyWikilinkPlainTextToMentions(
          e as PlateEditor,
          v,
          wikilinkMentionResolveDocumentId,
        ) as Value;
      }
      return ensureNonEmptyValue(v);
    } catch {
      return ensureNonEmptyValue(undefined);
    }
  }, [plugins, bootstrapMd, wikilinkMentionResolveDocumentId]);

  const editor = usePlateEditor({
    plugins,
    value: initialValue,
  });

  useEffect(() => {
    if (!editor || !companyId) return;
    const completeOptions = editor.getOptions(CopilotPlugin).completeOptions ?? {};
    const completeBody =
      completeOptions.body && typeof completeOptions.body === 'object'
        ? (completeOptions.body as Record<string, unknown>)
        : {};
    editor.setOption(CopilotPlugin, 'completeOptions', {
      ...completeOptions,
      api: `/api/companies/${companyId}/ai/copilot`,
      credentials: 'include',
      body: {
        ...completeBody,
        documentId,
      },
    });

    const prevChat = editor.getOptions(aiChatPlugin).chatOptions ?? {};
    const prevChatBody =
      prevChat.body && typeof prevChat.body === 'object'
        ? (prevChat.body as Record<string, unknown>)
        : {};
    editor.setOption(aiChatPlugin, 'chatOptions', {
      ...prevChat,
      api: `/api/companies/${companyId}/ai/plate-command`,
      body: {
        ...prevChatBody,
        documentId,
      },
    });
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5414ad03-148a-4367-b6cb-a798cd64057b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'57354f'},body:JSON.stringify({sessionId:'57354f',runId:'post-fix',hypothesisId:'H1',location:'client/src/components/PlateEditor/PlateFullKitMarkdownDocumentEditor.tsx:useEffect',message:'Configured Plate editor AI: copilot + plate-command',data:{companyId,documentId,copilotApi:`/api/companies/${companyId}/ai/copilot`,plateCommandApi:`/api/companies/${companyId}/ai/plate-command`},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [editor, companyId, documentId]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        fullBleed ? 'h-full flex-1 rounded-none border-0 bg-transparent' : 'rounded-md border border-input bg-background',
        /* React Flow: wheel over this subtree scrolls content instead of zooming the canvas (@xyflow `noWheelClassName`, default "nowheel"). */
        isCanvasCard && 'nowheel rounded-none border-0 bg-transparent',
        className,
      )}
    >
      <Plate
        editor={editor}
        readOnly={effectiveReadOnly}
        onValueChange={() => {
          if (effectiveReadOnly) return;
          try {
            const mdRaw = serializeMd(editor as never);
            const md = normalizeMarkdownWikilinksForPersistence(mdRaw);
            onMarkdownChange(md);
          } catch {
            // ignore serialization errors during partial updates
          }
        }}
      >
        <div className={cn('flex gap-4', fullBleed && 'min-h-0 flex-1 flex-col', isCanvasCard && 'min-h-0')}>
          <div
            ref={editorCardRef}
            className={cn(
              'relative min-w-0 flex-1 overflow-visible',
              fullBleed ? 'min-h-0 flex-1 rounded-none border-0 bg-transparent' : 'rounded-lg border border-border/60 bg-card/30',
              isCanvasCard && 'rounded-none border-0 bg-transparent',
            )}
          >
            <EditorContainer
              className={cn(
                fullBleed ? 'h-full! min-h-0 flex-1' : 'min-h-[400px]',
                isCanvasCard &&
                  (canvasCardBodyMaxHeightPx != null
                    ? '!min-h-0 !h-auto overflow-y-auto py-1'
                    : /* Fit mode: cap height so trackpad/wheel scrolls document instead of only zooming the board */
                      '!min-h-0 !h-auto max-h-[min(75vh,720px)] overflow-y-auto py-1'),
              )}
              style={
                isCanvasCard && canvasCardBodyMaxHeightPx != null
                  ? { maxHeight: canvasCardBodyMaxHeightPx }
                  : undefined
              }
              variant={fullBleed ? 'document' : isCanvasCard ? 'document' : 'demo'}
            >
              <Editor
                variant={fullBleed ? 'document' : isCanvasCard ? 'document' : 'demo'}
                placeholder={
                  effectiveReadOnly
                    ? undefined
                    : (editorPlaceholder ?? 'Write… Markdown is saved as the document body.')
                }
                spellCheck={false}
                disabled={effectiveReadOnly}
                className={cn(
                  isCanvasCard &&
                    '!h-auto !min-h-0 !w-full !px-2 !pt-1 !pb-3 !sm:px-2 prose prose-sm dark:prose-invert max-w-none [&_audio]:max-w-full [&_img]:max-w-full [&_video]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:break-words',
                )}
              />
            </EditorContainer>
            {!effectiveReadOnly ? (
              <OutlineScrollThumb anchorRef={editorCardRef} position="sticky" />
            ) : null}
          </div>
        </div>
      </Plate>
    </div>
  );
}

export default PlateFullKitMarkdownDocumentEditor;
