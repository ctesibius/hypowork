import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Network } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  ForceGraph3D,
  DOC_GRAPH_VIEW_PRESETS,
  applyDocGraphViewPreset,
  applyDocGraphHighlightChrome,
  augmentDocGraphForHighlight,
  setupDocGraphHighlightInteraction,
  type DocGraphViewPresetId,
  type ForceGraph3DInstance,
} from "@hypowork/doc-graph-3d";
import { documentsApi } from "../api/documents";
import { queryKeys } from "../lib/queryKeys";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_STORAGE_KEY = "hypowork:documentsGraph:viewPreset";

function loadStoredPreset(): DocGraphViewPresetId {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (raw && DOC_GRAPH_VIEW_PRESETS.some((p) => p.id === raw)) {
      return raw as DocGraphViewPresetId;
    }
  } catch {
    /* ignore */
  }
  return "directionalParticles";
}

export function DocumentsGraph() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { theme: appTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);
  const [preset, setPreset] = useState<DocGraphViewPresetId>(() => loadStoredPreset());

  useEffect(() => {
    setBreadcrumbs([{ label: "Documents" }, { label: "Graph" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.companyDocuments.graph(selectedCompanyId!),
    queryFn: () => documentsApi.graph(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const graphPayload = useMemo(() => {
    if (!data) return null;
    return {
      nodes: data.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind })),
      links: data.links.map((l) => ({ ...l })),
    };
  }, [data]);

  useEffect(() => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, preset);
    } catch {
      /* ignore */
    }
  }, [preset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!selectedCompanyId || !el || !graphPayload) return;

    if (graphPayload.nodes.length === 0) {
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }
      return;
    }

    if (graphRef.current) {
      graphRef.current._destructor();
      graphRef.current = null;
    }

    const fg = new ForceGraph3D(el, { controlType: "orbit" });
    graphRef.current = fg;

    const measure = () => ({
      w: el.clientWidth,
      h: Math.max(380, Math.min(920, window.innerHeight - 240)),
    });
    const { w, h } = measure();
    fg.width(w);
    fg.height(h);

    const prepared =
      preset === "highlight" ? augmentDocGraphForHighlight(graphPayload) : graphPayload;

    fg.graphData(prepared);

    if (preset === "highlight") {
      applyDocGraphHighlightChrome(fg, { theme: appTheme });
      setupDocGraphHighlightInteraction(fg, { theme: appTheme });
    } else {
      applyDocGraphViewPreset(fg, preset, { theme: appTheme });
    }

    fg.onNodeClick((node: { id?: string | number }) => {
      const id = String(node.id ?? "");
      if (id) navigate(`/documents/${id}`);
    });

    const onResize = () => {
      const m = measure();
      fg.width(m.w);
      fg.height(m.h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      fg._destructor();
      graphRef.current = null;
    };
  }, [selectedCompanyId, graphPayload, preset, appTheme, navigate]);

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view the document graph." />;
  }

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load graph"}
      </p>
    );
  }

  const emptyLibrary = graphPayload !== null && graphPayload.nodes.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Document graph</h1>
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
            Nodes are company documents; edges are resolved{" "}
            <code className="text-xs">[[wikilink]]</code> and <code className="text-xs">@</code> links. Choose a
            visual preset inspired by <code className="text-xs">3d-force-graph</code> demos; colors follow the app
            theme (light / mid / dark). Preset choice is saved in this browser.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-72">
          <Label htmlFor="doc-graph-preset">Graph view preset</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as DocGraphViewPresetId)}>
            <SelectTrigger id="doc-graph-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_GRAPH_VIEW_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id} title={`${p.example} — ${p.label}`}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative min-h-[420px] w-full flex-1 overflow-hidden rounded-lg border border-border bg-background">
        {emptyLibrary ? (
          <div className="flex h-[min(60vh,520px)] items-center justify-center p-4">
            <EmptyState
              icon={Network}
              message="No documents yet. Create notes and link them with [[title]] or @doc/slug to see edges."
            />
          </div>
        ) : null}
        <div
          ref={containerRef}
          className={emptyLibrary ? "hidden" : "absolute inset-0 min-h-[420px]"}
          aria-hidden={emptyLibrary}
        />
      </div>
    </div>
  );
}
