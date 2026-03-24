/**
 * SharedBoard — unified board component that renders Kanban / List / Table / Gantt views
 * from a domain-independent port, driven by an adapter that translates raw rows.
 *
 * Usage:
 *   const port = issuesAdapter.toKanbanPort(issues);
 *   <SharedBoard adapter={issuesAdapter} rows={issues} port={port} viewMode="board" ... />
 *
 * The adapter maps domain rows → shared port shapes. SharedBoard never imports domain types.
 */
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
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, formatDateTime } from "../../lib/utils";
import { Columns3, List, Table2, ChartGantt } from "lucide-react";
import type {
  BoardAdapter,
  BoardCard,
  BoardViewMode,
  GanttPort,
  KanbanCard,
  KanbanColumn,
  KanbanPort,
  ListCard,
  ListPort,
  TableColumn,
  TablePort,
} from "./ports";

// ── Shared Board Card (generic, rendered via renderCard prop) ─────────────────

export type SharedBoardHandlers<T extends BoardCard> = {
  onSelectCard: (id: string) => void;
  selectedId: string | null;
};

export type SharedBoardProps<T extends BoardCard> = {
  /** Adapter providing port builders */
  adapter: BoardAdapter<T>;
  /** Raw domain rows */
  rows: T[];
  /** Pre-built port from adapter (avoids rebuilding on every render) */
  port: KanbanPort | ListPort | TablePort | GanttPort;
  /** Current view mode */
  viewMode: BoardViewMode;
  /** Row selection + callbacks */
  handlers: SharedBoardHandlers<T>;
  /** Called when a card is dragged to a new column (Kanban cross-column move) */
  onMoveCard?: (cardId: string, newStatus: string) => void;
  /** Render a card given its data and context (used by Kanban and List) */
  renderCard?: (card: KanbanCard | ListCard, ctx: { isDragging: boolean; isSelected: boolean }) => React.ReactNode;
  /** Extra class */
  className?: string;
};

function formatTick(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

// ── View Mode Toggle ─────────────────────────────────────────────────────────

const VIEW_MODE_ICONS: Record<BoardViewMode, React.ElementType> = {
  list: List,
  board: Columns3,
  table: Table2,
  gantt: ChartGantt,
};

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: BoardViewMode;
  onChange: (m: BoardViewMode) => void;
}) {
  const modes: BoardViewMode[] = ["list", "board", "table", "gantt"];
  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
      {modes.map((m) => {
        const Icon = VIEW_MODE_ICONS[m];
        return (
          <button
            key={m}
            type="button"
            title={`${m} view`}
            className={cn(
              "p-2 transition-colors",
              m !== "gantt" && "border-l border-border",
              mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(m)}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

// ── Kanban ──────────────────────────────────────────────────────────────────

function DraggableCard({
  card,
  isSelected,
  onSelect,
  renderCard,
  draggable = true,
}: {
  card: KanbanCard | ListCard;
  isSelected: boolean;
  onSelect: (id: string) => void;
  renderCard?: (card: KanbanCard | ListCard, ctx: { isDragging: boolean; isSelected: boolean }) => React.ReactNode;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !draggable,
  });
  const style = transform
    ? { transform: CSS.Transform.toString(transform), zIndex: isDragging ? 20 : undefined }
    : undefined;

  if (renderCard) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {renderCard(card, { isDragging, isSelected })}
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(card.id)}
      className={cn(
        "w-full rounded border px-1.5 py-1.5 text-left text-xs transition-colors touch-none",
        isSelected ? "border-primary bg-primary/10" : "border-transparent bg-background/60 hover:bg-muted/50",
        isDragging && "opacity-40",
      )}
    >
      <span className="line-clamp-2 font-medium">{card.title}</span>
    </button>
  );
}

function KanbanColumnComponent({
  column,
  handlers,
  renderCard,
  dndEnabled,
}: {
  column: KanbanColumn;
  handlers: SharedBoardHandlers<KanbanCard | ListCard>;
  renderCard?: (card: KanbanCard | ListCard, ctx: { isDragging: boolean; isSelected: boolean }) => React.ReactNode;
  dndEnabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.status}`,
    disabled: !dndEnabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-border bg-muted/15 p-2 min-h-[120px] flex flex-col",
        dndEnabled && isOver && "ring-2 ring-primary/35",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 shrink-0">
        {column.label}
        <span className="ml-1 font-normal text-muted-foreground/80">({column.cards.length})</span>
      </p>
      <div className="space-y-1 min-h-0 flex-1 overflow-y-auto max-h-[min(40vh,320px)]">
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              isSelected={handlers.selectedId === card.id}
              onSelect={handlers.onSelectCard}
              renderCard={renderCard}
              draggable={dndEnabled}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SharedKanban<T extends BoardCard>({
  port,
  handlers,
  onMoveCard,
  renderCard,
  className,
}: {
  port: KanbanPort;
  handlers: SharedBoardHandlers<T>;
  onMoveCard?: (cardId: string, newStatus: string) => void;
  renderCard?: (card: KanbanCard | ListCard, ctx: { isDragging: boolean; isSelected: boolean }) => React.ReactNode;
  className?: string;
}) {
  const dndEnabled = Boolean(onMoveCard);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const findCardStatus = (cardId: string): string | null => {
    for (const col of port.columns) {
      if (col.cards.some((c) => c.id === cardId)) return col.status;
    }
    return port.otherStatusCards.find((c) => c.id === cardId)?._rawStatus ?? null;
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!onMoveCard) return;
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const activeId = String(active.id);
    if (!overId.startsWith("col-") || !port.columns.some((c) => c.cards.some((card) => card.id === activeId))) return;
    const nextStatus = overId.slice(4);
    const cur = findCardStatus(activeId);
    if (!cur || cur === nextStatus) return;
    onMoveCard(activeId, nextStatus);
  };

  const gridClass =
    port.otherStatusCards.length > 0
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";

  const grid = (
    <div className={cn("grid gap-2 shrink-0", gridClass)}>
      {port.columns.map((col) => (
        <KanbanColumnComponent
          key={col.status}
          column={col}
          handlers={handlers}
          renderCard={renderCard}
          dndEnabled={dndEnabled}
        />
      ))}
      {port.otherStatusCards.length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-2 min-h-[120px] flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 mb-2 shrink-0">
            Other status
            <span className="ml-1 font-normal">({port.otherStatusCards.length})</span>
          </p>
          <div className="space-y-1 min-h-0 flex-1 overflow-y-auto max-h-[min(40vh,320px)]">
            {port.otherStatusCards.map((card) => (
              <DraggableCard
                key={card.id}
                card={card}
                isSelected={handlers.selectedId === card.id}
                onSelect={handlers.onSelectCard}
                renderCard={renderCard}
                draggable={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (dndEnabled) {
    return (
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className={cn("flex flex-col gap-3", className)}>{grid}</div>
      </DndContext>
    );
  }
  return <div className={cn("flex flex-col gap-3", className)}>{grid}</div>;
}

// ── Table ────────────────────────────────────────────────────────────────────

function SharedTable<T extends BoardCard>({
  port,
  handlers,
}: {
  port: TablePort;
  handlers: SharedBoardHandlers<T>;
}) {
  if (port.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No rows. Add one below.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            {port.columns.map((col) => (
              <th
                key={col.id}
                className={cn("px-3 py-2 font-medium", col.align === "right" && "text-right")}
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {port.rows.map((row) => {
            const selected = handlers.selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/80 cursor-pointer transition-colors",
                  selected ? "bg-primary/10" : "hover:bg-muted/40",
                )}
                onClick={() => handlers.onSelectCard(row.id)}
              >
                {port.columns.map((col) => {
                  const raw = (row as Record<string, unknown>)[col.accessor];
                  const display =
                    col.accessor === "createdAt" || col.accessor === "updatedAt"
                      ? formatDateTime(raw as string)
                      : col.accessor === "dependsOnCount"
                        ? String(raw)
                        : String(raw ?? "");

                  return (
                    <td
                      key={col.id}
                      className={cn(
                        "px-3 py-2 text-muted-foreground max-w-56 truncate",
                        col.align === "right" && "text-right tabular-nums",
                      )}
                      title={display}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

function SharedList<T extends BoardCard>({
  port,
  handlers,
}: {
  port: ListPort;
  handlers: SharedBoardHandlers<T>;
}) {
  if (port.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No items.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border divide-y divide-border/80">
      {port.rows.map((row) => {
        const selected = handlers.selectedId === row.id;
        return (
          <div
            key={row.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
              selected ? "bg-primary/10" : "hover:bg-muted/40",
            )}
            onClick={() => handlers.onSelectCard(row.id)}
          >
            <span className="line-clamp-2 flex-1 font-medium text-sm">{row.title}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{row.status.replaceAll("_", " ")}</span>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {formatDateTime(row.updatedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Gantt ────────────────────────────────────────────────────────────────────

function SharedGantt<T extends BoardCard>({
  port,
  handlers,
}: {
  port: GanttPort;
  handlers: SharedBoardHandlers<T>;
}) {
  if (port.bars.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/35 bg-primary/5 px-4 py-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Timeline (Gantt)</p>
        <p className="mt-2">No items with dates to display.</p>
      </div>
    );
  }

  const span = Math.max(port.rangeEndMs - port.rangeStartMs, 1);
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = port.rangeStartMs + (span * i) / (tickCount - 1);
    return { ms: t, label: formatTick(t) };
  });

  return (
    <div className="rounded-lg border-2 border-border bg-card overflow-hidden flex flex-col shadow-sm">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Timeline</p>
        <p className="text-[10px] text-muted-foreground">
          {port.timeBasis === "planned"
            ? "Planned dates"
            : port.timeBasis === "mixed"
              ? `Mixed: ${port.plannedDateBarCount} of ${port.bars.length} use planned dates`
              : "Created / updated timestamps"}
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
          const selected = handlers.selectedId === bar.id;

          return (
            <div
              key={bar.id}
              className="grid grid-cols-[minmax(8rem,11rem)_1fr] gap-2 items-center min-h-8"
            >
              <button
                type="button"
                onClick={() => handlers.onSelectCard(bar.id)}
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
                  onClick={() => handlers.onSelectCard(bar.id)}
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
                  title={`${bar.status} · ${bar.dependsOnWorkOrderIds.length} deps`}
                >
                  <span className="opacity-90">{bar.status.replaceAll("_", " ")}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main SharedBoard ─────────────────────────────────────────────────────────

export function SharedBoard<T extends BoardCard>({
  adapter: _adapter,
  rows: _rows,
  port,
  viewMode,
  handlers,
  onMoveCard,
  renderCard,
  className,
}: SharedBoardProps<T>) {
  if (viewMode === "board") {
    return (
      <SharedKanban
        port={port as KanbanPort}
        handlers={handlers as SharedBoardHandlers<BoardCard>}
        onMoveCard={onMoveCard as (cardId: string, newStatus: string) => void | undefined}
        renderCard={renderCard}
        className={className}
      />
    );
  }
  if (viewMode === "table") {
    return (
      <SharedTable
        port={port as TablePort}
        handlers={handlers as SharedBoardHandlers<BoardCard>}
      />
    );
  }
  if (viewMode === "gantt") {
    return (
      <SharedGantt
        port={port as GanttPort}
        handlers={handlers as SharedBoardHandlers<BoardCard>}
      />
    );
  }
  // list (default)
  return (
    <SharedList
      port={port as ListPort}
      handlers={handlers as SharedBoardHandlers<BoardCard>}
    />
  );
}
