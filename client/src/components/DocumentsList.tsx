import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./PageSkeleton";
import { DocumentRow } from "./DocumentRow";
import { formatDate } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { useCompany } from "../context/CompanyContext";
import type { CompanyDocument } from "../api/documents";
import { Link2, Trash2 } from "lucide-react";

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
    return title.includes(s) || body.includes(s) || d.id.toLowerCase().includes(s);
  });
}

export interface DocumentsListProps {
  documents: CompanyDocument[];
  isLoading?: boolean;
  error?: Error | null;
  documentLinkState?: unknown;
  onNewDocument: () => void;
  onLinkDocument: (doc: CompanyDocument) => void;
  onDeleteDocument: (id: string) => void;
  viewStateKey?: string;
}

export function DocumentsList({
  documents,
  isLoading,
  error,
  documentLinkState,
  onNewDocument,
  onLinkDocument,
  onDeleteDocument,
  viewStateKey = "paperclip:documents-view",
}: DocumentsListProps) {
  const { selectedCompanyId } = useCompany();
  const scopedKey = selectedCompanyId ? `${viewStateKey}:${selectedCompanyId}` : viewStateKey;

  const [viewState, setViewState] = useState<DocumentsViewState>(() => getViewState(scopedKey));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const prevScopedKey = useRef(scopedKey);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (prevScopedKey.current !== scopedKey) {
      prevScopedKey.current = scopedKey;
      setViewState(getViewState(scopedKey));
    }
  }, [scopedKey]);

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

  const filtered = useMemo(
    () => sortDocuments(filterDocuments(documents, debouncedSearch), viewState),
    [documents, debouncedSearch, viewState],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button size="sm" variant="outline" onClick={onNewDocument}>
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">New document</span>
          </Button>
          <div className="relative w-48 sm:w-64 md:w-80">
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
              <Button variant="ghost" size="sm" className="text-xs">
                <ArrowUpDown className="h-3.5 w-3.5 sm:mr-1 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">Sort</span>
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

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={FileText}
          message={
            documents.length === 0
              ? "No documents yet."
              : "No documents match your search."
          }
          action={documents.length === 0 ? "New document" : undefined}
          onAction={documents.length === 0 ? onNewDocument : undefined}
        />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-1">
          {filtered.map((d) => (
            <DocumentRow
              key={d.id}
              document={d}
              documentLinkState={documentLinkState}
              desktopLeadingSpacer
              mobileMeta={timeAgo(d.updatedAt)}
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
      )}
    </div>
  );
}
