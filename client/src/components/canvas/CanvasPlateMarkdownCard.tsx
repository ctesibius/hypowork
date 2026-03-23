'use client';

import { PlateFullKitMarkdownDocumentEditor } from '@/components/PlateEditor/PlateFullKitMarkdownDocumentEditor';
import { cn } from '@/lib/utils';

/**
 * Canvas-only surface: same Plate **full kit** plugins as the main document editor (slash `/`, mentions, etc.),
 * with `presentation="canvasCard"` layout. Use **`readOnly`** vs explicit **`readOnly={false}`** to toggle
 * preview vs in-card edit — do not import `PlateFullKitMarkdownDocumentEditor` directly on canvas nodes.
 */
export function CanvasPlateMarkdownCard({
  documentId,
  markdown,
  reloadKey,
  readOnly,
  onMarkdownChange,
  wikilinkMentionResolveDocumentId,
  editorPlaceholder,
  className,
  canvasCardBodyMaxHeightPx,
}: {
  documentId: string;
  markdown: string;
  reloadKey: number;
  readOnly: boolean;
  onMarkdownChange: (markdown: string) => void;
  wikilinkMentionResolveDocumentId?: (wikilinkTitle: string) => string | null;
  editorPlaceholder?: string;
  className?: string;
  /** When set, body scrolls inside this max height (canvas partial mode). */
  canvasCardBodyMaxHeightPx?: number;
}) {
  return (
    <PlateFullKitMarkdownDocumentEditor
      documentId={documentId}
      reloadNonce={reloadKey}
      initialMarkdown={markdown}
      onMarkdownChange={onMarkdownChange}
      readOnly={readOnly}
      presentation="canvasCard"
      wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
      editorPlaceholder={editorPlaceholder}
      canvasCardBodyMaxHeightPx={canvasCardBodyMaxHeightPx}
      className={cn('min-w-0 max-w-full', className)}
    />
  );
}
