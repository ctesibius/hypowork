import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn, formatDateTime } from "@/lib/utils";
import type { SfWorkOrder } from "@/api/software-factory";
import type { PlannerGanttPort, PlannerKanbanPort } from "@/ports/software-factory-planner";
import { humanizePlannerStatus } from "@/ports/software-factory-planner";

export type PlannerBoardCardHandlers = {
  onSelectCard: (workOrderId: string) => void;
  selectedWorkOrderId: string | null;
};

/** Dense table — same SSOT rows as API; sort: `sort_order` then title. */
export function PlannerTableFromPort({
  rows,
  handlers,
  className,
}: {
  rows: SfWorkOrder[];
  handlers: PlannerBoardCardHandlers;
  className?: string;
}) {
  const { onSelectCard, selectedWorkOrderId } = handlers;
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [rows],
  );

  if (sorted.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No work orders. Add one below.
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border overflow-x-auto", className)}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
            <th className="px-3 py-2 font-medium text-right tabular-nums">Order</th>
            <th className="px-3 py-2 font-medium text-right tabular-nums">Deps</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Created</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Updated</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((w) => {
            const selected = selectedWorkOrderId === w.id;
            return (
              <tr
                key={w.id}
                className={cn(
                  "border-b border-border/80 cursor-pointer transition-colors",
                  selected ? "bg-primary/10" : "hover:bg-muted/40",
                )}
                onClick={() => onSelectCard(w.id)}
              >
                <td className="px-3 py-2 font-medium text-foreground max-w-56 truncate" title={w.title}>
                  {w.title}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {humanizePlannerStatus(w.status)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{w.sortOrder}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {w.dependsOnWorkOrderIds?.length ?? 0}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap tabular-nums">
                  {formatDateTime(w.createdAt)}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap tabular-nums">
                  {formatDateTime(w.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KanbanCardButton({
  card,
  selected,
  onSelectCard,
  dragProps,
  showStatusLine,
}: {
  card: { workOrderId: string; title: string; dependsOnCount: number; status?: string };
  selected: boolean;
  onSelectCard: (id: string) => void;
  dragProps?: { setNodeRef: (node: HTMLElement | null) => void; style?: React.CSSProperties } & Record<
    string,
    unknown
  >;
  showStatusLine?: boolean;
}) {
  const { setNodeRef, style, ...rest } = dragProps ?? {};
  return (
    <button
      ref={setNodeRef as React.Ref<HTMLButtonElement> | undefined}
      type="button"
      style={style}
      {...rest}
      onClick={() => onSelectCard(card.workOrderId)}
      className={cn(
        "w-full rounded border px-1.5 py-1.5 text-left text-xs transition-colors touch-none",
        selected ? "border-primary bg-primary/10" : "border-transparent bg-background/60 hover:bg-muted/50",
      )}
    >
      <span className="line-clamp-2 font-medium">{card.title}</span>
      {card.dependsOnCount > 0 ? (
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {card.dependsOnCount} dependenc{card.dependsOnCount === 1 ? "y" : "ies"}
        </span>
      ) : null}
      {showStatusLine && card.status ? (
        <span className="mt-0.5 block text-[10px] text-muted-foreground">{humanizePlannerStatus(card.status)}</span>
      ) : null}
    </button>
  );
}

function DraggableKanbanCard({
  card,
  selected,
  onSelectCard,
  showStatusLine,
}: {
  card: { workOrderId: string; title: string; dependsOnCount: number; status?: string };
  selected: boolean;
  onSelectCard: (id: string) => void;
  showStatusLine?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sf-kwo-${card.workOrderId}`,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, zIndex: isDragging ? 20 : undefined }
    : undefined;
  return (
    <KanbanCardButton
      card={card}
      selected={selected}
      onSelectCard={onSelectCard}
      showStatusLine={showStatusLine}
      dragProps={{ setNodeRef, style, ...listeners, ...attributes }}
    />
  );
}

function KanbanColumn({
  status,
  label,
  cardCount,
  children,
  dnd,
}: {
  status: string;
  label: string;
  cardCount: number;
  children: React.ReactNode;
  dnd?: boolean;
}) {
  const dropId = `sf-kcol-${status}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId, disabled: !dnd });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-border bg-muted/15 p-2 min-h-[120px] flex flex-col",
        dnd && isOver && "ring-2 ring-primary/35",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 shrink-0">
        {label}
        <span className="ml-1 font-normal text-muted-foreground/80">({cardCount})</span>
      </p>
      <div className="space-y-1 min-h-0 flex-1 overflow-y-auto max-h-[min(40vh,320px)]">{children}</div>
    </div>
  );
}

/** Presentational Kanban from {@link PlannerKanbanPort}; optional drag across columns → PATCH status. */
export function PlannerKanbanFromPort({
  port,
  handlers,
  className,
  onCardMoveToStatus,
}: {
  port: PlannerKanbanPort;
  handlers: PlannerBoardCardHandlers;
  className?: string;
  onCardMoveToStatus?: (workOrderId: string, newStatus: string) => void;
}) {
  const { onSelectCard, selectedWorkOrderId } = handlers;
  const showOther = port.otherStatusCards.length > 0;
  const dnd = Boolean(onCardMoveToStatus);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const findCardStatus = (workOrderId: string): string | null => {
    for (const col of port.columns) {
      if (col.cards.some((c) => c.workOrderId === workOrderId)) return col.status;
    }
    const o = port.otherStatusCards.find((c) => c.workOrderId === workOrderId);
    return o?.status ?? null;
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!onCardMoveToStatus) return;
    const overId = event.over?.id;
    const activeId = event.active.id;
    if (typeof overId !== "string" || typeof activeId !== "string") return;
    if (!overId.startsWith("sf-kcol-") || !activeId.startsWith("sf-kwo-")) return;
    const nextStatus = overId.slice("sf-kcol-".length);
    const woId = activeId.slice("sf-kwo-".length);
    const cur = findCardStatus(woId);
    if (!cur || cur === nextStatus) return;
    onCardMoveToStatus(woId, nextStatus);
  };

  const grid = (
    <div
      className={cn(
        "grid gap-2 shrink-0",
        showOther ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {port.columns.map((col) => (
        <KanbanColumn key={col.status} status={col.status} label={col.label} cardCount={col.cards.length} dnd={dnd}>
          {col.cards.map((c) =>
            dnd ? (
              <DraggableKanbanCard
                key={c.workOrderId}
                card={c}
                selected={selectedWorkOrderId === c.workOrderId}
                onSelectCard={onSelectCard}
              />
            ) : (
              <KanbanCardButton
                key={c.workOrderId}
                card={c}
                selected={selectedWorkOrderId === c.workOrderId}
                onSelectCard={onSelectCard}
              />
            ),
          )}
        </KanbanColumn>
      ))}
      {showOther ? (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-2 min-h-[120px] flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 mb-2 shrink-0">
            Other status
            <span className="ml-1 font-normal">({port.otherStatusCards.length})</span>
          </p>
          <div className="space-y-1 min-h-0 flex-1 overflow-y-auto max-h-[min(40vh,320px)]">
            {port.otherStatusCards.map((c) =>
              dnd ? (
                <DraggableKanbanCard
                  key={c.workOrderId}
                  card={c}
                  selected={selectedWorkOrderId === c.workOrderId}
                  onSelectCard={onSelectCard}
                  showStatusLine
                />
              ) : (
                <KanbanCardButton
                  key={c.workOrderId}
                  card={c}
                  selected={selectedWorkOrderId === c.workOrderId}
                  onSelectCard={onSelectCard}
                  showStatusLine
                />
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {dnd ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {grid}
        </DndContext>
      ) : (
        grid
      )}
    </div>
  );
}

function formatTick(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

/** Simple timeline: one row per bar, %-positioned; no external chart deps. */
export function PlannerGanttFromPort({
  port,
  handlers,
  className,
}: {
  port: PlannerGanttPort;
  handlers: PlannerBoardCardHandlers;
  className?: string;
}) {
  const { onSelectCard, selectedWorkOrderId } = handlers;
  const span = Math.max(port.rangeEndMs - port.rangeStartMs, 1);
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = port.rangeStartMs + (span * i) / (tickCount - 1);
    return { ms: t, label: formatTick(t) };
  });

  if (port.bars.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 border-dashed border-primary/35 bg-primary/5 px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <p className="font-medium text-foreground">Timeline (Gantt)</p>
        <p className="mt-2">No work orders yet. Add one in the list below, then switch to Board + timeline or Timeline only.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border-2 border-border bg-card overflow-hidden flex flex-col shadow-sm", className)}>
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Timeline</p>
        <p className="text-[10px] text-muted-foreground max-w-[min(100%,28rem)] leading-snug">
          {port.timeBasis === "planned" ? (
            <>
              Bars use <span className="font-mono">planned_start_at</span> → <span className="font-mono">planned_end_at</span>.
            </>
          ) : port.timeBasis === "mixed" ? (
            <>
              Mixed: <span className="font-mono">planned_*</span> when both set ({port.plannedDateBarCount} of{" "}
              {port.bars.length}); else <span className="font-mono">created_at</span>→<span className="font-mono">updated_at</span>.
            </>
          ) : (
            <>
              Bars use <span className="font-mono">created_at</span> → <span className="font-mono">updated_at</span>. Set
              planned start/end on work orders for schedule-based bars.
            </>
          )}
        </p>
      </div>
      <div className="px-2 pt-2 pb-1 border-b border-border/80">
        <div className="relative h-5 text-[10px] text-muted-foreground">
          {ticks.map((tk) => {
            const leftPct = ((tk.ms - port.rangeStartMs) / span) * 100;
            return (
              <span
                key={tk.ms}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${leftPct}%` }}
              >
                {tk.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[min(55vh,420px)] p-2 space-y-1">
        {port.bars.map((bar) => {
          const leftPct = ((bar.startMs - port.rangeStartMs) / span) * 100;
          const widthPct = Math.max(((bar.endMs - bar.startMs) / span) * 100, 0.35);
          const selected = selectedWorkOrderId === bar.workOrderId;
          return (
            <div
              key={bar.workOrderId}
              className="grid grid-cols-[minmax(8rem,11rem)_1fr] gap-2 items-center min-h-8"
            >
              <button
                type="button"
                onClick={() => onSelectCard(bar.workOrderId)}
                className={cn(
                  "text-left text-xs font-medium truncate rounded px-1 py-0.5 -mx-1 hover:bg-muted/50",
                  selected && "text-primary",
                )}
                title={bar.title}
              >
                {bar.title}
              </button>
              <div className="relative h-8 bg-muted/40 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => onSelectCard(bar.workOrderId)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 h-6 rounded-md border-2 text-left px-2 overflow-hidden text-[10px] leading-6 truncate shadow-sm",
                    selected
                      ? "bg-primary/35 border-primary ring-2 ring-primary/25"
                      : "bg-primary/25 border-primary/60 hover:bg-primary/40",
                  )}
                  style={{
                    left: `${leftPct}%`,
                    width: `max(${widthPct}%, 48px)`,
                    maxWidth: "calc(100% - 4px)",
                  }}
                  title={`${humanizePlannerStatus(bar.status)} · ${bar.dependsOnWorkOrderIds.length} deps`}
                >
                  <span className="opacity-90">{humanizePlannerStatus(bar.status)}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
