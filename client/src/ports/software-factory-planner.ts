/**
 * Planner view port — single source of truth shapes derived from API / DB work orders.
 * UI libraries can consume {@link PlannerKanbanPort} and {@link PlannerGanttPort} without
 * touching raw {@link SfWorkOrder} rows; swap presenters later by keeping these builders.
 */
import type { SfWorkOrder } from "../api/software-factory";

/** Default column order; matches `software_factory_work_orders.status` conventions. */
export const PLANNER_KANBAN_STATUS_ORDER = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
] as const;

export type PlannerKanbanStatusId = (typeof PLANNER_KANBAN_STATUS_ORDER)[number];

/** Fields we expose to planner views (ISO 8601 strings as returned by JSON API). */
export type PlannerWorkOrderSsot = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  sortOrder: number;
  dependsOnWorkOrderIds: string[];
  linkedBlueprintId: string | null;
  linkedIssueId: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  assigneeAgentId: string | null;
  assignedUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toPlannerWorkOrderSsot(row: SfWorkOrder): PlannerWorkOrderSsot {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    status: row.status,
    sortOrder: row.sortOrder,
    dependsOnWorkOrderIds: row.dependsOnWorkOrderIds ?? [],
    linkedBlueprintId: row.linkedBlueprintId ?? null,
    linkedIssueId: row.linkedIssueId ?? null,
    plannedStartAt: row.plannedStartAt ?? null,
    plannedEndAt: row.plannedEndAt ?? null,
    assigneeAgentId: row.assigneeAgentId ?? null,
    assignedUserId: row.assignedUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function humanizePlannerStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export type PlannerKanbanCard = {
  workOrderId: string;
  title: string;
  status: string;
  sortOrder: number;
  dependsOnCount: number;
};

export type PlannerKanbanColumn = {
  status: string;
  label: string;
  cards: PlannerKanbanCard[];
};

export type PlannerKanbanPort = {
  columns: PlannerKanbanColumn[];
  /** Rows whose `status` is not in the canonical board order */
  otherStatusCards: PlannerKanbanCard[];
};

/**
 * Groups work orders into Kanban columns. Sorting: `sort_order` ASC, then title.
 */
export function buildPlannerKanbanPort(
  rows: SfWorkOrder[],
  statusOrder: readonly string[] = PLANNER_KANBAN_STATUS_ORDER,
): PlannerKanbanPort {
  const ssot = rows.map(toPlannerWorkOrderSsot);
  const byStatus = new Map<string, PlannerKanbanCard[]>();
  for (const s of statusOrder) {
    byStatus.set(s, []);
  }
  const other: PlannerKanbanCard[] = [];

  for (const r of ssot) {
    const card: PlannerKanbanCard = {
      workOrderId: r.id,
      title: r.title,
      status: r.status,
      sortOrder: r.sortOrder,
      dependsOnCount: r.dependsOnWorkOrderIds.length,
    };
    const bucket = byStatus.get(r.status);
    if (bucket) bucket.push(card);
    else other.push(card);
  }

  const sortCards = (a: PlannerKanbanCard, b: PlannerKanbanCard) =>
    a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.title.localeCompare(b.title);

  for (const bucket of byStatus.values()) {
    bucket.sort(sortCards);
  }
  other.sort(sortCards);

  return {
    columns: statusOrder.map((status) => ({
      status,
      label: humanizePlannerStatus(status),
      cards: byStatus.get(status) ?? [],
    })),
    otherStatusCards: other,
  };
}

/** How timeline bar endpoints were derived (`mixed` = some rows use planned dates, some fall back). */
export type PlannerGanttTimeBasis = "planned" | "created_updated_at" | "mixed";

export type PlannerGanttBar = {
  workOrderId: string;
  title: string;
  status: string;
  sortOrder: number;
  startMs: number;
  endMs: number;
  dependsOnWorkOrderIds: string[];
};

export type PlannerGanttPort = {
  rangeStartMs: number;
  rangeEndMs: number;
  bars: PlannerGanttBar[];
  timeBasis: PlannerGanttTimeBasis;
  /** Count of rows using planned dates (rest fall back to created→updated). */
  plannedDateBarCount: number;
};

const DAY_MS = 86_400_000;
const MIN_BAR_MS = DAY_MS / 6;

function parseIsoMs(iso: string, fallback: number): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : fallback;
}

/**
 * Timeline bars: prefer `planned_start_at` / `planned_end_at` when both set; else `created_at` → `updated_at`.
 */
export function buildPlannerGanttPort(rows: SfWorkOrder[], nowMs: number = Date.now()): PlannerGanttPort {
  const ssot = rows.map(toPlannerWorkOrderSsot);
  const bars: PlannerGanttBar[] = [];
  let plannedDateBarCount = 0;

  for (const r of ssot) {
    let startMs: number;
    let endMs: number;
    if (r.plannedStartAt && r.plannedEndAt) {
      startMs = parseIsoMs(r.plannedStartAt, nowMs);
      endMs = parseIsoMs(r.plannedEndAt, startMs);
      plannedDateBarCount += 1;
    } else {
      startMs = parseIsoMs(r.createdAt, nowMs);
      endMs = parseIsoMs(r.updatedAt, startMs);
    }
    if (endMs < startMs) endMs = startMs + MIN_BAR_MS;
    if (endMs - startMs < MIN_BAR_MS) endMs = startMs + MIN_BAR_MS;

    bars.push({
      workOrderId: r.id,
      title: r.title,
      status: r.status,
      sortOrder: r.sortOrder,
      startMs,
      endMs,
      dependsOnWorkOrderIds: r.dependsOnWorkOrderIds,
    });
  }

  bars.sort(
    (a, b) => a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.startMs - b.startMs,
  );

  let rangeStartMs = nowMs - 7 * DAY_MS;
  let rangeEndMs = nowMs + DAY_MS;
  if (bars.length > 0) {
    rangeStartMs = Math.min(...bars.map((b) => b.startMs), rangeStartMs);
    rangeEndMs = Math.max(...bars.map((b) => b.endMs), rangeEndMs);
  }
  const pad = (rangeEndMs - rangeStartMs) * 0.02 || DAY_MS;
  rangeStartMs -= pad;
  rangeEndMs += pad;

  const timeBasis: PlannerGanttTimeBasis =
    plannedDateBarCount === 0
      ? "created_updated_at"
      : plannedDateBarCount === ssot.length
        ? "planned"
        : "mixed";

  return {
    rangeStartMs,
    rangeEndMs,
    bars,
    timeBasis,
    plannedDateBarCount,
  };
}
