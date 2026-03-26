import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  CheckSquare,
  Calendar,
  FileText,
  LayoutGrid,
  Plus,
  Search,
  Trash2,
  FolderOpen,
  Upload,
  X,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./PageSkeleton";
import { DocumentRow } from "./DocumentRow";
import { formatDate } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { useCompany } from "../context/CompanyContext";
import { documentCollectionPath, type CompanyDocument } from "../api/documents";

type SortField = "title" | "created" | "updated";
type SortDir = "asc" | "desc";

type DocumentsViewState = {
  sortField: SortField;
  sortDir: SortDir;
};

const defaultViewState: DocumentsViewState = {
  sortField: "updated",
  sortDir: "desc",
};

type DateField = "created" | "updated";

function getViewState(key: string): DocumentsViewState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaultViewState, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...defaultViewState };
}

function saveViewState(key: string, state: DocumentsViewState) {
  localStorage.setItem(key, JSON.stringify(state));
}

function sortDocuments(docs: CompanyDocument[], state: DocumentsViewState): CompanyDocument[] {
  const sorted = [...docs];
  const dir = state.sortDir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (state.sortField) {
      case "title":
        return dir * (a.title ?? "").localeCompare(b.title ?? "");
      case "created":
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "updated":
        return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      default:
        return 0;
    }
  });
  return sorted;
}

function filterDocuments(docs: CompanyDocument[], q: string): CompanyDocument[] {
  const s = q.trim().toLowerCase();
  if (!s) return docs;
  return docs.filter((d) => {
    const title = (d.title ?? "").toLowerCase();
    const body = (d.body ?? "").toLowerCase();
    const coll = (documentCollectionPath(d) ?? "").toLowerCase();
    return (
      title.includes(s) ||
      body.includes(s) ||
      coll.includes(s) ||
      d.id.toLowerCase().includes(s)
    );
  });
}

function compareCollectionPath(a: string | null | undefined, b: string | null | undefined): number {
  const ar = a == null || a === "";
  const br = b == null || b === "";
  if (ar && br) return 0;
  if (ar) return -1;
  if (br) return 1;
  return a.localeCompare(b);
}

export interface DocumentsListProps {
  documents: CompanyDocument[];
  isLoading?: boolean;
  error?: Error | null;
  documentLinkState?: unknown;
  onNewDocument: () => void;
  /** Creates a canvas document (per MVP); omit to hide the control. */
  onNewCanvasDocument?: () => void;
  /** Opens the import dialog. */
  onImport?: () => void;
  onLinkDocument: (doc: CompanyDocument) => void;
  onDeleteDocument: (id: string) => void;
  /** PATCH the placement for one document (blank/empty = Root). */
  onMoveDocument?: (id: string, collectionPath: string | null) => void | Promise<unknown>;
  /** When set, rows show checkboxes and a bulk-delete control. */
  onDeleteMany?: (ids: string[]) => void | Promise<unknown>;
  viewStateKey?: string;
}

export function DocumentsList({
  documents,
  isLoading,
  error,
  documentLinkState,
  onNewDocument,
  onNewCanvasDocument,
  onImport,
  onLinkDocument,
  onDeleteDocument,
  onMoveDocument,
  onDeleteMany,
  viewStateKey = "paperclip:documents-view",
}: DocumentsListProps) {
  const { selectedCompanyId } = useCompany();
  const scopedKey = selectedCompanyId ? `${viewStateKey}:${selectedCompanyId}` : viewStateKey;

  const [viewState, setViewState] = useState<DocumentsViewState>(() => getViewState(scopedKey));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateField, setDateField] = useState<DateField>("updated");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const prevScopedKey = useRef(scopedKey);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (prevScopedKey.current !== scopedKey) {
      prevScopedKey.current = scopedKey;
      setViewState(getViewState(scopedKey));
      setSelectedIds(new Set());
    }
  }, [scopedKey]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateView = useCallback(
    (patch: Partial<DocumentsViewState>) => {
      setViewState((prev) => {
        const next = { ...prev, ...patch };
        saveViewState(scopedKey, next);
        return next;
      });
    },
    [scopedKey],
  );

  const parseLocalDateToMs = useCallback((s: string, endOfDay: boolean): number | null => {
    const v = s.trim();
    if (!v) return null;
    // `input type="date"` yields `YYYY-MM-DD`.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return null;
    const y = Number.parseInt(m[1]!, 10);
    const mo = Number.parseInt(m[2]!, 10);
    const d = Number.parseInt(m[3]!, 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

    const start = new Date(y, mo - 1, d).getTime();
    if (!endOfDay) return start;
    // inclusive "to": end of the day (local time)
    const nextDayStart = new Date(y, mo - 1, d + 1).getTime();
    return nextDayStart - 1;
  }, []);

  const dateFromMs = parseLocalDateToMs(dateFrom, false);
  const dateToMs = parseLocalDateToMs(dateTo, true);
  const dateActive = dateFromMs != null || dateToMs != null;

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [moveCollectionPath, setMoveCollectionPath] = useState<string>("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movePending, setMovePending] = useState(false);

  const moveTargetDoc = useMemo(
    () => (moveTargetId ? documents.find((d) => d.id === moveTargetId) ?? null : null),
    [documents, moveTargetId],
  );

  const collectionPathOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) {
      const p = documentCollectionPath(d);
      if (p) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const grouped = useMemo(() => {
    const filteredBySearch = filterDocuments(documents, debouncedSearch);
    const filtered = filteredBySearch.filter((d) => {
      const t = new Date(dateField === "created" ? d.createdAt : d.updatedAt).getTime();
      if (dateFromMs != null && t < dateFromMs) return false;
      if (dateToMs != null && t > dateToMs) return false;
      return true;
    });
    const byCollection = new Map<string | null, CompanyDocument[]>();
    for (const d of filtered) {
      const k = documentCollectionPath(d);
      const list = byCollection.get(k) ?? [];
      list.push(d);
      byCollection.set(k, list);
    }
    const keys = [...byCollection.keys()].sort(compareCollectionPath);
    return keys.map((collectionPath) => ({
      collectionPath,
      docs: sortDocuments(byCollection.get(collectionPath)!, viewState),
    }));
  }, [documents, debouncedSearch, viewState, dateField, dateFromMs, dateToMs]);

  const visibleDocCount = useMemo(
    () => grouped.reduce((n, g) => n + g.docs.length, 0),
    [grouped],
  );

  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of grouped) {
      for (const d of g.docs) ids.push(d.id);
    }
    return ids;
  }, [grouped]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (visibleIds.length === 0) return next;
      if (visibleIds.every((id) => next.has(id))) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [visibleIds]);

  const searchActive = debouncedSearch.trim().length > 0;
  const filtersActive = searchActive || dateActive;
  const countIsFiltered = filtersActive && visibleDocCount !== documents.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-1.5">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onNewDocument}
            title="New document"
            aria-label="New document"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {onNewCanvasDocument ? (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={onNewCanvasDocument}
              title="New canvas"
              aria-label="New canvas"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          ) : null}
          {onImport ? (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={onImport}
              title="Import markdown or ZIP"
              aria-label="Import"
            >
              <Upload className="h-4 w-4" />
            </Button>
          ) : null}
          {onDeleteMany ? (
            <>
              {visibleIds.length > 0 ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={toggleSelectAllVisible}
                  title={
                    allVisibleSelected
                      ? "Deselect visible documents"
                      : "Select all visible documents (respects search)"
                  }
                  aria-label={allVisibleSelected ? "Deselect visible" : "Select all visible"}
                >
                  <CheckSquare className="h-4 w-4" />
                </Button>
              ) : null}
              {selectedIds.size > 0 ? (
                <>
                  <span
                    className="text-xs tabular-nums text-muted-foreground px-0.5"
                    title={`${selectedIds.size} selected`}
                  >
                    {selectedIds.size}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    title="Delete selected"
                    aria-label="Delete selected documents"
                    onClick={() => {
                      const ids = [...selectedIds];
                      if (!confirm(`Delete ${ids.length} document(s)? This cannot be undone.`)) return;
                      void (async () => {
                        try {
                          await Promise.resolve(onDeleteMany(ids));
                          setSelectedIds(new Set());
                        } catch {
                          /* caller / mutation handles error UI */
                        }
                      })();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                    title="Clear selection"
                    aria-label="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
          <span
            className="select-none text-xs tabular-nums text-muted-foreground border-l border-border pl-2 ml-0.5 sm:pl-2.5 sm:ml-1"
            title={
              countIsFiltered
                ? `${visibleDocCount} of ${documents.length} documents match search`
                : `${documents.length} document${documents.length === 1 ? "" : "s"}`
            }
          >
            {countIsFiltered ? `${visibleDocCount}/${documents.length}` : documents.length}
          </span>
          <div className="relative min-w-32 flex-1 sm:min-w-48 sm:max-w-md md:max-w-lg">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="pl-7 text-xs sm:text-sm"
              aria-label="Search documents"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-xs"
                title="Filter by date"
                aria-label="Filter by date"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="space-y-3 p-3">
                <div className="space-y-1">
                  <Label>Date field</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={dateField}
                    onChange={(e) => setDateField(e.target.value as DateField)}
                  >
                    <option value="updated">Updated</option>
                    <option value="created">Created</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>From</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>To</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!dateActive}
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setDateField("updated");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-xs"
                title="Sort"
                aria-label="Sort documents"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-0">
              <div className="space-y-0.5 p-2">
                {(
                  [
                    ["title", "Title"],
                    ["created", "Created"],
                    ["updated", "Updated"],
                  ] as const
                ).map(([field, label]) => (
                  <button
                    key={field}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${
                      viewState.sortField === field
                        ? "bg-accent/50 text-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                    onClick={() => {
                      if (viewState.sortField === field) {
                        updateView({ sortDir: viewState.sortDir === "asc" ? "desc" : "asc" });
                      } else {
                        updateView({ sortField: field, sortDir: "desc" });
                      }
                    }}
                  >
                    <span>{label}</span>
                    {viewState.sortField === field && (
                      <span className="text-xs text-muted-foreground">
                        {viewState.sortDir === "asc" ? "\u2191" : "\u2193"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading && <PageSkeleton variant="issues-list" />}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && grouped.length === 0 && (
        <EmptyState
          icon={FileText}
          message={
            documents.length === 0
              ? "No documents yet."
              : filtersActive
                ? "No documents match your filters."
                : "No documents match your search."
          }
          action={documents.length === 0 ? "New document" : undefined}
          onAction={documents.length === 0 ? onNewDocument : undefined}
        />
      )}

      {!isLoading && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(({ collectionPath, docs: collectionDocs }) => (
            <div key={collectionPath ?? "__root__"} className="space-y-0">
              <h3 className="border-b border-border bg-muted/30 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {collectionPath ? collectionPath : "Root"}
              </h3>
              <div className="space-y-0">
                {collectionDocs.map((d) => (
                  <DocumentRow
                    key={d.id}
                    document={d}
                    documentLinkState={documentLinkState}
                    desktopLeadingSpacer
                    mobileMeta={timeAgo(d.updatedAt)}
                    selection={
                      onDeleteMany
                        ? {
                            enabled: true,
                            checked: selectedIds.has(d.id),
                            onToggle: () => toggleSelect(d.id),
                          }
                        : undefined
                    }
                    desktopTrailing={
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Link to issue"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onLinkDocument(d);
                          }}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        {onMoveDocument ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Move to collection"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMoveError(null);
                              setMoveTargetId(d.id);
                              setMoveCollectionPath(documentCollectionPath(d) ?? "");
                              setMovePending(false);
                              setMoveOpen(true);
                            }}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          title="Delete"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm("Delete this document?")) onDeleteDocument(d.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    }
                    trailingMeta={formatDate(d.updatedAt)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={moveOpen}
        onOpenChange={(o) => {
          if (!o) {
            setMoveOpen(false);
            setMoveError(null);
            setMovePending(false);
          } else if (o && !moveTargetId && documents.length > 0) {
            // defensive: shouldn't happen, but avoid opening an empty dialog
            setMoveOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Move to collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use Obsidian-style folder paths. Empty means the workspace root.
            </p>
            <div className="space-y-2">
              <Label htmlFor="move-collection-path">Collection path</Label>
              <Input
                id="move-collection-path"
                list="move-collection-paths"
                value={moveCollectionPath}
                onChange={(e) => setMoveCollectionPath(e.target.value)}
                placeholder="e.g. Daily/2026-03-25"
                disabled={movePending}
              />
              <datalist id="move-collection-paths">
                {collectionPathOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            {moveError ? <p className="text-sm text-destructive">{moveError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMoveOpen(false);
                setMoveError(null);
                setMovePending(false);
              }}
              disabled={movePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                movePending || !onMoveDocument || !moveTargetDoc || !moveTargetDoc.latestRevisionId
              }
              onClick={async () => {
                if (!onMoveDocument || !moveTargetId || !moveTargetDoc) return;
                setMovePending(true);
                setMoveError(null);
                try {
                  const raw = moveCollectionPath.trim();
                  const next = raw.length > 0 ? raw : null;
                  await Promise.resolve(onMoveDocument(moveTargetId, next));
                  setMoveOpen(false);
                } catch (err) {
                  setMoveError(err instanceof Error ? err.message : String(err));
                } finally {
                  setMovePending(false);
                }
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
