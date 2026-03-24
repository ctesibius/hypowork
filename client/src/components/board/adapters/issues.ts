/**
 * Issues → shared board port adapter.
 * Translates Issue[] (domain type) into the shared KanbanPort / ListPort / TablePort / GanttPort shapes.
 */
import type { Issue } from "@paperclipai/shared";
import type {
  BoardAdapter,
  KanbanCard,
  KanbanPort,
  ListCard,
  ListPort,
  TableCard,
  TableColumn,
  TablePort,
} from "../ports";

/** Issue statuses that form the canonical Kanban column order for Issues. */
export const ISSUES_KANBAN_STATUS_ORDER: readonly string[] = [
  "in_progress",
  "todo",
  "backlog",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

/** Default table columns for Issues */
export const ISSUES_TABLE_COLUMNS: TableColumn[] = [
  { id: "title", label: "Title", accessor: "title" },
  { id: "status", label: "Status", accessor: "status" },
  { id: "priority", label: "Priority", accessor: "priority" },
  { id: "identifier", label: "ID", accessor: "identifier", width: 120 },
  { id: "createdAt", label: "Created", accessor: "createdAt", align: "right", width: 120 },
  { id: "updatedAt", label: "Updated", accessor: "updatedAt", align: "right", width: 120 },
];

function humanizeStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function toKanbanCard(issue: Issue): KanbanCard {
  return {
    id: issue.id,
    title: issue.title,
    status: issue.status,
    sortOrder: 0,
    dependsOnCount: 0,
    _rawStatus: issue.status,
  };
}

export const issuesAdapter: BoardAdapter<Issue> = {
  toKanbanPort(issues: Issue[]): KanbanPort {
    const byStatus = new Map<string, KanbanCard[]>();
    for (const s of ISSUES_KANBAN_STATUS_ORDER) {
      byStatus.set(s, []);
    }
    const other: KanbanCard[] = [];

    for (const issue of issues) {
      const card = toKanbanCard(issue);
      const bucket = byStatus.get(issue.status);
      if (bucket) bucket.push(card);
      else other.push(card);
    }

    return {
      columns: ISSUES_KANBAN_STATUS_ORDER.map((status) => ({
        status,
        label: humanizeStatus(status),
        cards: byStatus.get(status) ?? [],
      })),
      otherStatusCards: other,
    };
  },

  toListPort(issues: Issue[]): ListPort {
    const rows: ListCard[] = issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      status: issue.status,
      sortOrder: 0,
      createdAt: issue.createdAt instanceof Date ? issue.createdAt.toISOString() : String(issue.createdAt),
      updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : String(issue.updatedAt),
    }));
    return { rows };
  },

  toTablePort(issues: Issue[]): TablePort {
    const rows: TableCard[] = issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      status: issue.status,
      sortOrder: 0,
      dependsOnCount: 0,
      createdAt: issue.createdAt instanceof Date ? issue.createdAt.toISOString() : String(issue.createdAt),
      updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : String(issue.updatedAt),
    }));
    return { rows, columns: ISSUES_TABLE_COLUMNS };
  },

  // Issues don't have planned dates, so Gantt returns empty
  toGanttPort(_issues: Issue[]) {
    return {
      rangeStartMs: Date.now() - 7 * 86_400_000,
      rangeEndMs: Date.now() + 86_400_000,
      bars: [],
      timeBasis: "created_updated_at" as const,
      plannedDateBarCount: 0,
    };
  },
};
