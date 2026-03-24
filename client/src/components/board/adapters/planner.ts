/**
 * Planner (SfWorkOrder) → shared board port adapter.
 * Translates SfWorkOrder[] into shared port shapes, reusing the existing buildPlannerKanbanPort
 * and buildPlannerGanttPort implementations.
 */
import type { SfWorkOrder } from "../../../api/software-factory";
import {
  buildPlannerKanbanPort,
  buildPlannerGanttPort,
  humanizePlannerStatus,
  PLANNER_KANBAN_STATUS_ORDER,
} from "../../../ports/software-factory-planner";
import type {
  BoardAdapter,
  ListCard,
  ListPort,
  TableCard,
  TableColumn,
  TablePort,
} from "../ports";

/** Default table columns for Planner work orders */
export const PLANNER_TABLE_COLUMNS: TableColumn[] = [
  { id: "title", label: "Title", accessor: "title" },
  { id: "status", label: "Status", accessor: "status" },
  { id: "assignee", label: "Assignee", accessor: "assigneeLabel", width: 140 },
  { id: "sortOrder", label: "Order", accessor: "sortOrder", align: "right", width: 80 },
  { id: "dependsOn", label: "Deps", accessor: "dependsOnCount", align: "right", width: 60 },
  { id: "createdAt", label: "Created", accessor: "createdAt", align: "right", width: 120 },
  { id: "updatedAt", label: "Updated", accessor: "updatedAt", align: "right", width: 120 },
];

function toListCard(wo: SfWorkOrder): ListCard {
  return {
    id: wo.id,
    title: wo.title,
    status: wo.status,
    sortOrder: wo.sortOrder,
    createdAt: wo.createdAt,
    updatedAt: wo.updatedAt,
  };
}

function toTableCard(wo: SfWorkOrder): TableCard {
  return {
    id: wo.id,
    title: wo.title,
    status: wo.status,
    sortOrder: wo.sortOrder,
    dependsOnCount: wo.dependsOnWorkOrderIds?.length ?? 0,
    createdAt: wo.createdAt,
    updatedAt: wo.updatedAt,
  };
}

export const plannerAdapter: BoardAdapter<SfWorkOrder> = {
  // Reuse existing builder — returns PlannerKanbanPort (compatible with shared KanbanPort)
  toKanbanPort(rows: SfWorkOrder[]) {
    return buildPlannerKanbanPort(rows, PLANNER_KANBAN_STATUS_ORDER);
  },

  toListPort(rows: SfWorkOrder[]): ListPort {
    return {
      rows: rows.map(toListCard),
    };
  },

  toTablePort(rows: SfWorkOrder[]): TablePort {
    return {
      rows: rows.map(toTableCard),
      columns: PLANNER_TABLE_COLUMNS,
    };
  },

  // Reuse existing builder
  toGanttPort(rows: SfWorkOrder[]) {
    return buildPlannerGanttPort(rows);
  },
};

export { humanizePlannerStatus };
