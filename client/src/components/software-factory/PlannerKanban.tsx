/**
 * PlannerKanban — rich Kanban board for work orders.
 * Mirrors the KanbanBoard (Issues) design: SortableContext, DragOverlay, status column headers,
 * cross-column drag to change status.
 *
 * Data: PlannerKanbanPort (from plannerAdapter.toKanbanPort)
 * Handlers: onSelectCard, selectedId, onMoveCard (cross-column)
 */
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { humanizePlannerStatus } from "@/ports/software-factory-planner";
import type { KanbanCard, KanbanColumn, KanbanPort } from "../board/ports";
import { StatusIcon } from "../StatusIcon";
import { HorizontalScrollStrip } from "../HorizontalScrollStrip";

export type PlannerKanbanHandlers = {
  onSelectCard: (id: string) => void;
  selectedId: string | null;
};

function PlannerKanbanCard({
  card,
  handlers,
  isOverlay,
}: {
  card: KanbanCard & { _rawStatus?: string };
  handlers: PlannerKanbanHandlers;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) {
          e.preventDefault();
          return;
        }
        if (!isOverlay) handlers.onSelectCard(card.id);
      }}
      className={cn(
        "rounded-md border bg-card p-2.5 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && !isOverlay ? "opacity-30" : "",
        isOverlay ? "shadow-lg ring-1 ring-primary/20 cursor-grabbing" : "hover:shadow-sm",
      )}
    >
      <p className="text-sm leading-snug line-clamp-2 mb-1.5">{card.title}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {card.assigneeLabel ? (
          <span className="max-w-full truncate text-[10px] text-muted-foreground" title={card.assigneeLabel}>
            {card.assigneeLabel}
          </span>
        ) : null}
        {card.dependsOnCount > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            {card.dependsOnCount} dep{card.dependsOnCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {card._rawStatus ? (
          <span className="text-[10px] text-muted-foreground">{humanizePlannerStatus(card._rawStatus)}</span>
        ) : null}
      </div>
    </div>
  );
}

function PlannerKanbanColumn({
  column,
  handlers,
}: {
  column: KanbanColumn;
  handlers: PlannerKanbanHandlers;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  return (
    <div className="flex h-full min-h-0 min-w-[260px] w-[260px] shrink-0 flex-col self-stretch">
      <div className="mb-1 flex shrink-0 items-center gap-2 px-2 py-2">
        <StatusIcon status={column.status} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {column.label}
        </span>
        <span className="ml-auto tabular-nums text-xs text-muted-foreground/60">
          {column.cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] flex-1 space-y-1 overflow-y-auto overflow-x-hidden rounded-md p-1 transition-colors [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          isOver ? "bg-accent/40" : "bg-muted/20",
        )}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <PlannerKanbanCard key={card.id} card={card} handlers={handlers} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function PlannerKanban({
  port,
  handlers,
  onMoveCard,
  className,
}: {
  port: KanbanPort;
  handlers: PlannerKanbanHandlers;
  onMoveCard?: (id: string, newStatus: string) => void;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeCard = useMemo(() => {
    if (!activeId) return null;
    for (const col of port.columns) {
      const found = col.cards.find((c) => c.id === activeId);
      if (found) return found;
    }
    return port.otherStatusCards.find((c) => c.id === activeId) ?? null;
  }, [activeId, port]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!onMoveCard) return;
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const overId = over.id as string;

    let targetStatus: string | null = null;

    if (port.columns.some((c) => c.status === overId)) {
      targetStatus = overId;
    } else {
      for (const col of port.columns) {
        if (col.cards.some((c) => c.id === overId)) {
          targetStatus = col.status;
          break;
        }
      }
    }

    if (!targetStatus) return;

    const currentStatus =
      port.columns.find((c) => c.cards.some((card) => card.id === cardId))?.status ??
      port.otherStatusCards.find((c) => c.id === cardId)?._rawStatus ??
      null;

    if (currentStatus && currentStatus !== targetStatus) {
      onMoveCard(cardId, targetStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
        <HorizontalScrollStrip stretch className="min-h-0 flex-1" scrollerClassName="gap-3 pb-2 pt-0">
          {port.columns.map((col) => (
            <PlannerKanbanColumn key={col.status} column={col} handlers={handlers} />
          ))}
          {port.otherStatusCards.length > 0 && (
            <div className="flex h-full min-h-0 min-w-[260px] w-[260px] shrink-0 flex-col self-stretch">
              <div className="mb-1 flex shrink-0 items-center gap-2 px-2 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                  Other status
                </span>
                <span className="ml-auto tabular-nums text-xs text-muted-foreground/60">
                  {port.otherStatusCards.length}
                </span>
              </div>
              <div className="min-h-[120px] flex-1 space-y-1 overflow-y-auto overflow-x-hidden rounded-md border border-dashed border-amber-500/30 bg-muted/10 p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <SortableContext
                  items={port.otherStatusCards.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {port.otherStatusCards.map((card) => (
                    <PlannerKanbanCard key={card.id} card={card} handlers={handlers} />
                  ))}
                </SortableContext>
              </div>
            </div>
          )}
        </HorizontalScrollStrip>
      </div>
      <DragOverlay>
        {activeCard ? (
          <PlannerKanbanCard card={activeCard} handlers={handlers} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
