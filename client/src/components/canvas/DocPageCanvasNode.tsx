import { memo, useCallback, useMemo } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  FileType2,
  Maximize2,
  PanelBottom,
  Pencil,
} from "lucide-react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CanvasPlateMarkdownCard } from "./CanvasPlateMarkdownCard";
import { hashMarkdownBootstrapKey } from "./canvasMarkdownBootstrapKey";
import { useCanvasChrome } from "./canvas-chrome-context";
import type { DocPageCanvasData } from "./normalizeDocumentCanvasNodes";

const CARD_W_MIN = 240;
const CARD_W_MAX = 720;
const PARTIAL_DEFAULT_PX = 280;
const PARTIAL_MIN_PX = 120;
const PARTIAL_MAX_PX = 720;
/** Drag-release below this height collapses the card body. */
const SNAP_COLLAPSE_BODY_BELOW_PX = 88;

function clampCardWidth(w: number): number {
  if (typeof window === "undefined") return Math.min(CARD_W_MAX, Math.max(CARD_W_MIN, w));
  const vw = window.innerWidth - 32;
  return Math.min(Math.min(CARD_W_MAX, vw), Math.max(CARD_W_MIN, w));
}

/**
 * Hypopedia / AFFiNE-style “Note on edgeless”.
 * Primary card = canonical prose (read-only Plate full kit). Other page cards = preview + optional edit (slash `/`).
 */
function DocPageCanvasNodeInner({ id, data }: NodeProps<Node<DocPageCanvasData, "docPage">>) {
  const { setNodes } = useReactFlow();
  const { viewMode, hostDocumentId, wikilinkMentionResolveDocumentId } = useCanvasChrome();
  const title = data.title?.trim() || "Untitled";
  const body = data.body ?? "";
  const isPrimary = Boolean(data.isPrimaryDocument);
  const collapsed = data.collapsed === true;
  const cardWidth = clampCardWidth(typeof data.cardWidth === "number" ? data.cardWidth : 360);
  const canvasEditing = data.canvasEditing === true;
  const bodyHeightMode = data.bodyHeightMode === "partial" ? "partial" : "fit";
  const storedBodyMax =
    typeof data.cardBodyMaxPx === "number" && Number.isFinite(data.cardBodyMaxPx)
      ? data.cardBodyMaxPx
      : PARTIAL_DEFAULT_PX;
  const cardBodyMaxPx = Math.min(PARTIAL_MAX_PX, Math.max(PARTIAL_MIN_PX, storedBodyMax));
  const isPartial = bodyHeightMode === "partial" && !collapsed;
  const canvasCardBodyMaxHeightPx = isPartial ? cardBodyMaxPx : undefined;

  const previewDocId = data.documentId ?? hostDocumentId;
  const bodyPreviewKey = useMemo(() => hashMarkdownBootstrapKey(body), [body]);

  const patchData = useCallback(
    (patch: Partial<DocPageCanvasData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...(n.data as DocPageCanvasData), ...patch } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const readOnlyForPlate = isPrimary || viewMode || !canvasEditing;

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      const startX = e.clientX;
      const startW = cardWidth;
      el.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const next = clampCardWidth(startW + (ev.clientX - startX));
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: { ...(n.data as DocPageCanvasData), cardWidth: next },
                }
              : n,
          ),
        );
      };
      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [cardWidth, id, setNodes],
  );

  const onBodyHeightResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isPartial) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      const startY = e.clientY;
      const startH = cardBodyMaxPx;
      el.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientY - startY;
        const raw = Math.round(startH + delta);
        const clamped = Math.min(PARTIAL_MAX_PX, Math.max(48, raw));
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...(n.data as DocPageCanvasData),
                    cardBodyMaxPx: clamped,
                  },
                }
              : n,
          ),
        );
      };
      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const delta = ev.clientY - startY;
        let next = Math.round(startH + delta);
        if (next < SNAP_COLLAPSE_BODY_BELOW_PX) {
          patchData({ collapsed: true, bodyHeightMode: "fit", cardBodyMaxPx: undefined });
          return;
        }
        if (next < PARTIAL_MIN_PX) next = PARTIAL_MIN_PX;
        next = Math.min(PARTIAL_MAX_PX, Math.max(PARTIAL_MIN_PX, next));
        patchData({ cardBodyMaxPx: next, bodyHeightMode: "partial" });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [cardBodyMaxPx, id, isPartial, patchData, setNodes],
  );

  return (
    <div
      className={cn(
        "relative max-w-[calc(100vw-2rem)] select-none rounded-xl border border-border/90 bg-card shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        "flex flex-col overflow-visible",
      )}
      style={{ width: cardWidth }}
    >
      <Handle type="target" position={Position.Left} className="!border-border !bg-muted" />
      <div className="flex shrink-0 items-center gap-2 border-b border-border/80 bg-muted/40 px-2 py-2 pr-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/60">
          <FileType2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isPrimary ? "Document" : "Page"}
            </span>
            {isPrimary ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-medium text-primary">
                This note
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={title}>
            {title}
          </p>
        </div>
        {!isPrimary && !viewMode ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="nodrag h-8 w-8 shrink-0 text-muted-foreground"
            title={canvasEditing ? "Preview" : "Edit"}
            onClick={() => patchData({ canvasEditing: !canvasEditing })}
          >
            {canvasEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        ) : null}
        {!viewMode ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="nodrag h-8 w-8 shrink-0 text-muted-foreground"
            title={
              isPartial
                ? "Fit height — show full note height on canvas"
                : "Partial height — scroll inside card (drag bottom edge to resize)"
            }
            onClick={() => {
              if (isPartial) {
                patchData({ bodyHeightMode: "fit", cardBodyMaxPx: undefined });
              } else {
                patchData({
                  bodyHeightMode: "partial",
                  cardBodyMaxPx:
                    typeof data.cardBodyMaxPx === "number" && data.cardBodyMaxPx >= PARTIAL_MIN_PX
                      ? data.cardBodyMaxPx
                      : PARTIAL_DEFAULT_PX,
                });
              }
            }}
          >
            {isPartial ? <Maximize2 className="h-4 w-4" /> : <PanelBottom className="h-4 w-4" />}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="nodrag h-8 w-8 shrink-0 text-muted-foreground"
          title={collapsed ? "Expand" : "Collapse"}
          onClick={() => patchData({ collapsed: !collapsed })}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
        {data.documentId && !isPrimary ? (
          <Link
            to={`/documents/${data.documentId}`}
            className="nodrag shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Open document"
          >
            <FileText className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="min-w-0 bg-background/95">
          <div className="nodrag min-w-0 max-w-full overflow-visible px-1.5 py-1">
            <CanvasPlateMarkdownCard
              key={`${previewDocId}-${bodyPreviewKey}-${readOnlyForPlate ? "ro" : "rw"}`}
              documentId={previewDocId || "canvas-doc"}
              reloadKey={bodyPreviewKey}
              canvasCardBodyMaxHeightPx={canvasCardBodyMaxHeightPx}
              markdown={
                body.trim()
                  ? body
                  : isPrimary
                    ? "_No content yet — use **Page** view to edit canonical prose._"
                    : "_Empty page — toggle Edit or type / for blocks._"
              }
              readOnly={readOnlyForPlate}
              onMarkdownChange={(md) => patchData({ body: md })}
              wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
              editorPlaceholder={
                canvasEditing && !isPrimary
                  ? "Write… Type / for blocks. Markdown is stored on this canvas card."
                  : undefined
              }
            />
          </div>
          {isPartial ? (
            <div
              role="separator"
              aria-hidden
              className="nodrag z-[5] h-2 w-full shrink-0 cursor-ns-resize border-t border-border/50 bg-muted/20 hover:bg-muted/45"
              title="Drag to resize body height (too small snaps to min or collapses)"
              onPointerDown={onBodyHeightResizePointerDown}
            />
          ) : null}
        </div>
      ) : null}

      <div
        role="separator"
        aria-hidden
        className="nodrag absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-br-sm border-t border-l border-border/60 bg-muted/30 hover:bg-muted/60"
        title="Drag to resize width"
        onPointerDown={onResizePointerDown}
      />

      <Handle type="source" position={Position.Right} className="!border-border !bg-muted" />
    </div>
  );
}

export const DocPageCanvasNode = memo(DocPageCanvasNodeInner);
