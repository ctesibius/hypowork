import { Link } from "@/lib/router";
import { HelpCircle, Menu } from "lucide-react";
import { useBreadcrumbs, type DocumentDetailChrome } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { useCompany } from "../context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PluginSlotOutlet, usePluginSlots } from "@/plugins/slots";
import { PluginLauncherOutlet, usePluginLaunchers } from "@/plugins/launchers";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function DocumentEditorHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="About this document editor"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,26rem)] max-h-[min(70vh,22rem)] overflow-y-auto">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Full Plate editor (same kit as{" "}
          <code className="rounded px-1 font-mono text-[10px] text-foreground">/plate-markdown-test</code>
          — see <code className="rounded px-1 font-mono text-[10px] text-foreground">src/kits/editor-kit.tsx</code>). Body is
          stored as Markdown; some rich blocks may round-trip lossily (see{" "}
          <code className="rounded px-1 font-mono text-[10px] text-foreground">
            components/PlateEditor/FEATURE_PARITY_PLAN.md
          </code>
          ). Autosaves after you pause typing. Inline Copilot defaults to the backend company route{" "}
          <code className="rounded px-1 font-mono text-[10px] text-foreground">
            /api/companies/:companyId/ai/copilot
          </code>{" "}
          (same instance LLM config as Chat). Use{" "}
          <code className="rounded px-1 font-mono text-[10px] text-foreground">VITE_AI_API_URL</code> only to
          override with an external provider (appends{" "}
          <code className="rounded px-1 font-mono text-[10px] text-foreground">/copilot</code>; see{" "}
          <code className="rounded px-1 font-mono text-[10px] text-foreground">src/kits/plugins/copilot-kit.tsx</code>).{" "}
          <kbd className="rounded border border-border px-1 py-0.5 text-[10px] text-foreground">⌘</kbd>+
          <kbd className="rounded border border-border px-1 py-0.5 text-[10px] text-foreground">Enter</kbd> from the title in
          the header still triggers save when focus moves; edits here sync to the same document body.
        </p>
      </PopoverContent>
    </Popover>
  );
}

type GlobalToolbarContext = { companyId: string | null; companyPrefix: string | null };

function DocumentBreadcrumbTitle({ chrome }: { chrome: DocumentDetailChrome }) {
  const [editing, setEditing] = useState(false);
  const snapshotRef = useRef("");
  const { title, onTitleChange } = chrome;

  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => {
      const el = document.getElementById("doc-breadcrumb-title") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editing]);

  if (editing) {
    return (
      <Input
        id="doc-breadcrumb-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        className="h-8 w-full min-w-24 max-w-full border-0 bg-transparent px-1 py-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-ring/40"
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onTitleChange(snapshotRef.current);
            setEditing(false);
          }
          if (e.key === "Enter") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        aria-current="page"
      />
    );
  }

  return (
    <button
      type="button"
      aria-label="Edit title"
      aria-current="page"
      onClick={() => {
        snapshotRef.current = title;
        setEditing(true);
      }}
      className={cn(
        "max-w-[min(100%,20rem)] truncate rounded px-1 py-0.5 text-left text-sm font-medium text-foreground hover:bg-muted/50",
        !title.trim() && "text-muted-foreground",
      )}
    >
      {title.trim() || "Untitled"}
    </button>
  );
}

function GlobalToolbarPlugins({ context }: { context: GlobalToolbarContext }) {
  const { slots } = usePluginSlots({ slotTypes: ["globalToolbarButton"], companyId: context.companyId });
  const { launchers } = usePluginLaunchers({ placementZones: ["globalToolbarButton"], companyId: context.companyId, enabled: !!context.companyId });
  if (slots.length === 0 && launchers.length === 0) return null;
  return (
    <div className="flex items-center gap-1 ml-auto shrink-0 pl-2">
      <PluginSlotOutlet slotTypes={["globalToolbarButton"]} context={context} className="flex items-center gap-1" />
      <PluginLauncherOutlet placementZones={["globalToolbarButton"]} context={context} className="flex items-center gap-1" />
    </div>
  );
}

export function BreadcrumbBar() {
  const { breadcrumbs, documentDetailChrome } = useBreadcrumbs();
  const { toggleSidebar, sidebarOpen, isMobile } = useSidebar();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const globalToolbarSlotContext = useMemo(
    () => ({
      companyId: selectedCompanyId ?? null,
      companyPrefix: selectedCompany?.issuePrefix ?? null,
    }),
    [selectedCompanyId, selectedCompany?.issuePrefix],
  );

  const globalToolbarSlots = <GlobalToolbarPlugins context={globalToolbarSlotContext} />;

  const menuButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="mr-2 shrink-0"
      onClick={toggleSidebar}
      aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );

  if (breadcrumbs.length === 0) {
    return (
      <div className="border-b border-border px-4 md:px-6 h-12 shrink-0 flex items-center">
        {menuButton}
        <div className="flex-1" />
        {globalToolbarSlots}
      </div>
    );
  }

  // Single breadcrumb = page title (uppercase)
  if (breadcrumbs.length === 1) {
    return (
      <div className="border-b border-border px-4 md:px-6 h-12 shrink-0 flex items-center">
        {menuButton}
        <div className="min-w-0 overflow-hidden flex-1">
          <h1 className="text-sm font-semibold uppercase tracking-wider truncate">
            {breadcrumbs[0].label}
          </h1>
        </div>
        {globalToolbarSlots}
      </div>
    );
  }

  // Multiple breadcrumbs = breadcrumb trail
  return (
    <div className="border-b border-border px-4 md:px-6 h-12 shrink-0 flex items-center gap-2">
      {menuButton}
      <div className="min-w-0 overflow-hidden flex-1">
        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              const showEditableTitle =
                isLast && crumb.kind === "document-title" && documentDetailChrome;
              return (
                <Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem className={isLast ? "min-w-0 max-w-full flex-1" : "shrink-0"}>
                    {showEditableTitle ? (
                      <DocumentBreadcrumbTitle chrome={documentDetailChrome} />
                    ) : isLast || !crumb.href ? (
                      <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {documentDetailChrome ? (
        <div className="flex shrink-0 items-center gap-2">
          {documentDetailChrome.autosaveLabel ? (
            <span className="max-w-22 truncate text-xs text-muted-foreground">
              {documentDetailChrome.autosaveLabel}
            </span>
          ) : null}
          <div className="flex shrink-0 items-center gap-0.5">
            <span
              className="text-xs text-muted-foreground tabular-nums"
              title="Revision number: increments on each successful save"
            >
              rev {documentDetailChrome.revisionNumber}
            </span>
            <DocumentEditorHelpPopover />
          </div>
          {documentDetailChrome.toolbarActions ? (
            <div className="flex items-center gap-0.5">{documentDetailChrome.toolbarActions}</div>
          ) : null}
        </div>
      ) : null}
      {globalToolbarSlots}
    </div>
  );
}
