/**
 * Shared board port types — unified interface for Kanban, List, Table, and Gantt views.
 * Adapters translate domain-specific rows (Issue, SfWorkOrder, etc.) into these shapes.
 * Shared components consume only these types; they never import domain types directly.
 */

// ── Base card / row ──────────────────────────────────────────────────────────

export type BoardCardId = string;

export type BoardCard = {
  id: BoardCardId;
  title: string;
  status: string;
  /** For display in "other status" catch-all column */
  _rawStatus?: string;
};

export type ListCard = BoardCard & {
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TableCard = BoardCard & {
  sortOrder: number;
  dependsOnCount: number;
  createdAt: string;
  updatedAt: string;
  /** Planner work orders, etc. */
  assigneeLabel?: string | null;
};

// ── Kanban ──────────────────────────────────────────────────────────────────

export type KanbanColumn = {
  status: string;
  label: string;
  cards: KanbanCard[];
};

export type KanbanCard = BoardCard & {
  sortOrder: number;
  dependsOnCount: number;
  /** Planner work orders: human-readable assignee */
  assigneeLabel?: string | null;
};

export type KanbanPort = {
  columns: KanbanColumn[];
  /** Rows whose status is not in the canonical column order */
  otherStatusCards: KanbanCard[];
};

// ── List ────────────────────────────────────────────────────────────────────

export type ListPort = {
  rows: ListCard[];
};

// ── Table ──────────────────────────────────────────────────────────────────

export type TableColumn = {
  id: string;
  label: string;
  /** Accessor key on the row object */
  accessor: string;
  align?: "left" | "center" | "right";
  width?: number;
};

export type TablePort = {
  rows: TableCard[];
  columns: TableColumn[];
};

// ── Gantt ───────────────────────────────────────────────────────────────────

export type GanttTimeBasis = "planned" | "created_updated_at" | "mixed";

export type GanttBar = {
  id: BoardCardId;
  title: string;
  status: string;
  sortOrder: number;
  startMs: number;
  endMs: number;
  dependsOnWorkOrderIds: string[];
};

export type GanttPort = {
  rangeStartMs: number;
  rangeEndMs: number;
  bars: GanttBar[];
  timeBasis: GanttTimeBasis;
  plannedDateBarCount: number;
};

// ── View mode ────────────────────────────────────────────────────────────────

export type BoardViewMode = "list" | "board" | "table" | "gantt";

// ── Adapter interface (for documentation / type safety) ───────────────────────

/**
 * Adapter contract: a set of functions that translate domain rows into
 * the shared port shapes consumed by SharedBoard.
 */
export type BoardAdapter<T> = {
  toKanbanPort: (rows: T[]) => KanbanPort;
  toListPort: (rows: T[]) => ListPort;
  toTablePort: (rows: T[]) => TablePort;
  toGanttPort: (rows: T[]) => GanttPort;
};
