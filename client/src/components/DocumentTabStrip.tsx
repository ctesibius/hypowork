import { useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "@/lib/router";
import { FileText, Layout, X } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useOpenDocumentTabs } from "../context/OpenDocumentTabsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HorizontalScrollStrip } from "./HorizontalScrollStrip";
import { cn } from "@/lib/utils";

export function DocumentTabStrip() {
  const { tabs, closeTab, activateTab } = useOpenDocumentTabs();
  const { documentId: routeDocumentId } = useParams<{ documentId: string }>();
  const { documentDetailChrome } = useBreadcrumbs();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (editingId && routeDocumentId && editingId !== routeDocumentId) {
      setEditingId(null);
    }
  }, [editingId, routeDocumentId]);

  useLayoutEffect(() => {
    if (!editingId) return;
    const id = requestAnimationFrame(() => {
      document.getElementById("doc-tab-title-input")?.focus();
      (document.getElementById("doc-tab-title-input") as HTMLInputElement | null)?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editingId]);

  if (tabs.length === 0) {
    return <div className="min-w-0 flex-1" aria-hidden />;
  }

  return (
    <HorizontalScrollStrip scrollAmount={200} className="min-w-0 flex-1" scrollerClassName="gap-0.5 pb-px pt-0.5">
      <div role="tablist" className="flex min-w-0 flex-nowrap gap-0.5">
        {tabs.map((tab) => {
          const isActive = routeDocumentId === tab.documentId;
          const canEditTitle =
            isActive && editingId === tab.documentId && documentDetailChrome;

          return (
            <div
              key={tab.documentId}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "flex max-w-[14rem] shrink-0 items-center gap-0.5 rounded-t-md border border-b-0 px-1.5 py-1 transition-colors",
                isActive
                  ? "border-border bg-background text-foreground shadow-sm"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium"
                onClick={() => {
                  if (routeDocumentId !== tab.documentId) {
                    activateTab(tab.documentId);
                  }
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  if (!isActive || !documentDetailChrome) return;
                  setEditingId(tab.documentId);
                }}
              >
                {tab.kind === "canvas" ? (
                  <Layout className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                )}
                {canEditTitle && documentDetailChrome ? (
                  <Input
                    id="doc-tab-title-input"
                    value={documentDetailChrome.title}
                    onChange={(e) => documentDetailChrome.onTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0.5 py-0 text-xs font-medium shadow-none focus-visible:ring-1 focus-visible:ring-ring/40"
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate select-none">
                    {tab.title.trim() || "Untitled"}
                  </span>
                )}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Close ${tab.title.trim() || "tab"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.documentId);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </HorizontalScrollStrip>
  );
}
