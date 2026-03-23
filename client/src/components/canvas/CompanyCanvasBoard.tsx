import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "@/lib/router";
import { FileText, FileType2, GitBranch, PenLine, StickyNote } from "lucide-react";
import { canvasesApi } from "../../api/canvases";
import { documentsApi } from "../../api/documents";
import { issuesApi } from "../../api/issues";
import { useCompany } from "../../context/CompanyContext";
import { queryKeys } from "../../lib/queryKeys";
import { loadCompanyCanvas, saveCompanyCanvas, clearCompanyCanvas } from "../../lib/companyCanvasStorage";
import { Input } from "@/components/ui/input";
import { DocPageCanvasNode } from "./DocPageCanvasNode";
import { HypoworkCanvasToolbar } from "./HypoworkCanvasToolbar";
import { CANVAS_SAVE_DEBOUNCE_MS } from "./canvas-constants";
import { CanvasAiAssistant } from "./CanvasAiAssistant";
import { CanvasChromeContext, useCanvasChrome } from "./canvas-chrome-context";
import { CanvasPlateMarkdownCard } from "./CanvasPlateMarkdownCard";
import { hashMarkdownBootstrapKey } from "./canvasMarkdownBootstrapKey";
import { getProseBody } from "../../lib/documentContent";
import { cn } from "@/lib/utils";

type StickyData = { body: string };
type DocRefData = { documentId: string; title: string };
type IssueRefData = { issueId: string; identifier: string | null; title: string };

const REF_CARD_W = 360;

const noopMarkdownChange = () => {};
type StageData = { label: string };
type SketchData = { body: string };
type FrameData = { label: string };

function StickyNodeInner({ id, data }: NodeProps<Node<StickyData, "sticky">>) {
  const { setNodes } = useReactFlow();
  return (
    <div className="w-[200px] rounded-md border border-amber-300/80 bg-amber-100 px-2 py-2 text-xs shadow-sm dark:bg-amber-950/40 dark:border-amber-700/60">
      <Handle type="target" position={Position.Left} className="!bg-amber-600" />
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-200/80">
        Note
      </div>
      <textarea
        className="nodrag nopan h-24 w-full resize-none rounded border border-amber-200/80 bg-white/80 p-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-800 dark:bg-amber-950/30"
        value={data.body}
        placeholder="Sticky note…"
        onChange={(e) => {
          const body = e.target.value;
          setNodes((nds) =>
            nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, body } } : n)),
          );
        }}
      />
      <Handle type="source" position={Position.Right} className="!bg-amber-600" />
    </div>
  );
}
const StickyNode = memo(StickyNodeInner);

function DocRefNodeInner({ data }: NodeProps<Node<DocRefData, "docRef">>) {
  const { selectedCompanyId } = useCompany();
  const { wikilinkMentionResolveDocumentId } = useCanvasChrome();
  const { data: remote, isLoading } = useQuery({
    queryKey: queryKeys.companyDocuments.detail(selectedCompanyId!, data.documentId),
    queryFn: () => documentsApi.get(selectedCompanyId!, data.documentId),
    enabled: Boolean(selectedCompanyId && data.documentId),
    staleTime: 60_000,
  });

  const prose = useMemo(() => getProseBody(remote ?? null), [remote]);
  const reloadKey = useMemo(() => hashMarkdownBootstrapKey(prose), [prose]);
  const title = (remote?.title ?? data.title)?.trim() || "Untitled";

  const markdown = useMemo(() => {
    if (isLoading && !remote) return "_Loading…_";
    if (!prose.trim()) return "_No prose body in this document yet._";
    return prose;
  }, [isLoading, remote, prose]);

  return (
    <div
      className={cn(
        "relative max-w-[calc(100vw-2rem)] select-none rounded-xl border border-border/90 bg-card shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        "flex flex-col overflow-visible",
      )}
      style={{ width: REF_CARD_W }}
    >
      <Handle type="target" position={Position.Left} className="!border-border !bg-muted" />
      <div className="flex shrink-0 items-center gap-2 border-b border-border/80 bg-muted/40 px-2 py-2 pr-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/60">
          <FileType2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Document</div>
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={title}>
            {title}
          </p>
        </div>
        <Link
          to={`/documents/${data.documentId}`}
          className="nodrag shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Open document"
        >
          <FileText className="h-4 w-4" />
        </Link>
      </div>
      <div className="min-w-0 bg-background/95">
        <div className="nodrag min-w-0 max-w-full overflow-visible px-1.5 py-1">
          <CanvasPlateMarkdownCard
            key={`docref-${data.documentId}-${reloadKey}`}
            documentId={data.documentId}
            reloadKey={reloadKey}
            markdown={markdown}
            readOnly
            onMarkdownChange={noopMarkdownChange}
            wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!border-border !bg-muted" />
    </div>
  );
}
const DocRefNode = memo(DocRefNodeInner);

function IssueRefNodeInner({ data }: NodeProps<Node<IssueRefData, "issueRef">>) {
  const { wikilinkMentionResolveDocumentId } = useCanvasChrome();
  const label = data.identifier ?? data.issueId.slice(0, 8);
  const { data: issue, isLoading } = useQuery({
    queryKey: queryKeys.issues.detail(data.issueId),
    queryFn: () => issuesApi.get(data.issueId),
    enabled: Boolean(data.issueId),
    staleTime: 60_000,
  });

  const description = (issue?.description ?? "").trim();
  const reloadKey = useMemo(() => hashMarkdownBootstrapKey(description), [description]);

  const markdown = useMemo(() => {
    if (isLoading && !issue) return "_Loading…_";
    if (!description) return "_No description._";
    return description;
  }, [isLoading, issue, description]);

  return (
    <div
      className={cn(
        "relative max-w-[calc(100vw-2rem)] select-none rounded-xl border border-violet-500/35 bg-card shadow-md ring-1 ring-violet-500/15 dark:ring-violet-400/20",
        "flex flex-col overflow-visible",
      )}
      style={{ width: REF_CARD_W }}
    >
      <Handle type="target" position={Position.Left} className="!border-border !bg-muted" />
      <div className="flex shrink-0 items-center gap-2 border-b border-violet-500/25 bg-violet-500/[0.07] px-2 py-2 pr-1 dark:bg-violet-950/30">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/60">
          <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Issue
          </div>
          <Link
            to={`/issues/${data.issueId}`}
            className="nodrag block truncate font-mono text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300"
            title="Open issue"
          >
            {label}
          </Link>
          <p className="truncate text-xs text-muted-foreground" title={data.title}>
            {data.title}
          </p>
        </div>
      </div>
      <div className="min-w-0 bg-background/95">
        <div className="nodrag min-w-0 max-w-full overflow-visible px-1.5 py-1">
          <CanvasPlateMarkdownCard
            key={`issueref-${data.issueId}-${reloadKey}`}
            documentId={`issue-${data.issueId}`}
            reloadKey={reloadKey}
            markdown={markdown}
            readOnly
            onMarkdownChange={noopMarkdownChange}
            wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!border-border !bg-muted" />
    </div>
  );
}
const IssueRefNode = memo(IssueRefNodeInner);

function StageNodeInner({ id, data }: NodeProps<Node<StageData, "stage">>) {
  const { setNodes } = useReactFlow();
  return (
    <div className="min-w-[140px] rounded-full border-2 border-dashed border-sky-500/50 bg-sky-500/10 px-4 py-2 text-center shadow-sm">
      <Handle type="target" position={Position.Top} />
      <Input
        className="nodrag nopan h-7 border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
        value={data.label}
        onChange={(e) => {
          const label = e.target.value;
          setNodes((nds) =>
            nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
          );
        }}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const StageNode = memo(StageNodeInner);

function SketchNodeInner({ id, data }: NodeProps<Node<SketchData, "sketch">>) {
  const { setNodes } = useReactFlow();
  return (
    <div className="w-[220px] rounded-lg border-2 border-dashed border-muted-foreground/40 bg-muted/20 p-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
        <PenLine className="h-3 w-3" />
        Sketch / whiteboard
      </div>
      <textarea
        className="nodrag nopan h-28 w-full resize-none rounded border border-border/60 bg-background/80 p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
        placeholder="Rough diagram notes, pinout ideas, ladder logic reminders…"
        value={data.body}
        onChange={(e) => {
          const body = e.target.value;
          setNodes((nds) =>
            nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, body } } : n)),
          );
        }}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const SketchNode = memo(SketchNodeInner);

function FrameNodeInner({ id, data }: NodeProps<Node<FrameData, "frame">>) {
  const { setNodes } = useReactFlow();
  return (
    <div className="h-full min-h-[200px] w-full min-w-[280px] rounded-xl border-2 border-dashed border-muted-foreground/40 bg-muted/5 p-3 shadow-inner">
      <Handle type="target" position={Position.Left} />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Frame</div>
      <Input
        className="nodrag nopan mt-1 h-8 border-border/60 bg-background/80 text-sm font-medium"
        value={data.label}
        onChange={(e) => {
          const label = e.target.value;
          setNodes((nds) =>
            nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
          );
        }}
      />
      <p className="mt-2 text-[10px] text-muted-foreground">Visual grouping — place cards inside (MVP).</p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const FrameNode = memo(FrameNodeInner);

export const hypoworkCanvasNodeTypes: NodeTypes = {
  sticky: StickyNode,
  docPage: DocPageCanvasNode,
  docRef: DocRefNode,
  issueRef: IssueRefNode,
  stage: StageNode,
  sketch: SketchNode,
  frame: FrameNode,
};

export function CompanyCanvasBoard() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId!;

  // Fetch persisted canvas from API; fall back to localStorage for offline/unmigrated.
  const { data: serverCanvas } = useQuery({
    queryKey: ["canvas", companyId],
    queryFn: () => canvasesApi.get(companyId),
    // Don't block on API — show local data immediately, sync in background.
    retry: false,
    staleTime: Infinity,
  });

  // Merge: prefer server data, fall back to localStorage.
  const initial = useMemo(
    () =>
      serverCanvas ?? loadCompanyCanvas(companyId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, serverCanvas],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
    setSelectedNodeId(selected.length === 1 ? selected[0]!.id : null);
  }, []);

  const { data: docs } = useQuery({
    queryKey: queryKeys.companyDocuments.list(companyId),
    queryFn: () => documentsApi.list(companyId),
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
  });

  const resolveWikilinkMentionDocumentId = useCallback(
    (wikilinkTitle: string) => {
      const q = wikilinkTitle.trim().toLowerCase();
      if (!q) return null;
      for (const d of docs ?? []) {
        const t = (d.title?.trim() || "Untitled").toLowerCase();
        if (t === q) return d.id;
      }
      return null;
    },
    [docs],
  );

  // Save to server + localStorage fallback.
  useEffect(() => {
    const t = window.setTimeout(async () => {
      saveCompanyCanvas(companyId, { nodes, edges });
      try {
        await canvasesApi.save(companyId, { nodes, edges });
      } catch {
        // API errors are non-fatal; localStorage keeps data safe.
      }
    }, CANVAS_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [companyId, nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: "smoothstep", animated: true }, eds));
    },
    [setEdges],
  );

  const clearBoard = useCallback(() => {
    if (!confirm("Remove all nodes and edges from this canvas?")) return;
    clearCompanyCanvas(companyId);
    canvasesApi.save(companyId, { nodes: [], edges: [] }).catch(() => {});
    setNodes([]);
    setEdges([]);
  }, [companyId, setNodes, setEdges]);

  return (
    <CanvasChromeContext.Provider
      value={{ viewMode: false, hostDocumentId: "", wikilinkMentionResolveDocumentId: resolveWikilinkMentionDocumentId }}
    >
      <div className="flex h-[min(85vh,calc(100vh-10rem))] min-h-[420px] w-full flex-col rounded-lg border border-border bg-muted/20">
        <div className="relative min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={hypoworkCanvasNodeTypes}
            snapToGrid={snapToGrid}
            snapGrid={[24, 24]}
            fitView
            minZoom={0.15}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            className="bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[length:20px_20px]"
          >
            <HypoworkCanvasToolbar
              setNodes={setNodes}
              setEdges={setEdges}
              docs={docs}
              issues={issues}
              onClear={clearBoard}
              toolbarTitle="Company canvas (legacy)"
              toolbarHint="Pan/zoom · drag between handles to connect"
              snapToGrid={snapToGrid}
              onToggleSnapToGrid={() => setSnapToGrid((s) => !s)}
            />
            <CanvasAiAssistant
              companyId={companyId}
              documentId={null}
              documentTitle={null}
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
            />
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap zoomable pannable className="!bg-card" />
            <Panel position="bottom-left" className="m-2 max-w-sm rounded-md border border-border bg-card/95 px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm">
              Prefer a <strong className="text-foreground">canvas document</strong> under Documents (per-note board). This view is the old single board per company.
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </CanvasChromeContext.Provider>
  );
}
