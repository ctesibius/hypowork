import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
import { FileText, GitBranch, LayoutGrid, Plus, StickyNote, Trash2, PenLine } from "lucide-react";
import { documentsApi } from "../../api/documents";
import { issuesApi } from "../../api/issues";
import { useCompany } from "../../context/CompanyContext";
import { queryKeys } from "../../lib/queryKeys";
import { loadCompanyCanvas, saveCompanyCanvas, clearCompanyCanvas } from "../../lib/companyCanvasStorage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type StickyData = { body: string };
type DocRefData = { documentId: string; title: string };
type IssueRefData = { issueId: string; identifier: string | null; title: string };
type StageData = { label: string };
type SketchData = { body: string };

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
  return (
    <div className="min-w-[180px] max-w-[240px] rounded-lg border-2 border-primary bg-card px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <FileText className="h-3 w-3" />
        Document
      </div>
      <Link
        to={`/documents/${data.documentId}`}
        className="nodrag mt-1 block truncate text-sm font-medium text-primary hover:underline"
      >
        {data.title?.trim() || "Untitled"}
      </Link>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const DocRefNode = memo(DocRefNodeInner);

function IssueRefNodeInner({ data }: NodeProps<Node<IssueRefData, "issueRef">>) {
  const label = data.identifier ?? data.issueId.slice(0, 8);
  return (
    <div className="min-w-[180px] max-w-[260px] rounded-lg border-2 border-violet-500/60 bg-card px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Issue</div>
      <Link
        to={`/issues/${data.issueId}`}
        className="nodrag mt-1 block font-mono text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400"
      >
        {label}
      </Link>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{data.title}</p>
      <Handle type="source" position={Position.Right} />
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

const nodeTypes: NodeTypes = {
  sticky: StickyNode,
  docRef: DocRefNode,
  issueRef: IssueRefNode,
  stage: StageNode,
  sketch: SketchNode,
};

const SAVE_DEBOUNCE_MS = 450;

type CanvasToolbarProps = {
  companyId: string;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  docs: Awaited<ReturnType<typeof documentsApi.list>> | undefined;
  issues: Awaited<ReturnType<typeof issuesApi.list>> | undefined;
};

function CanvasToolbar({ companyId, setNodes, setEdges, docs, issues }: CanvasToolbarProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [pickDocId, setPickDocId] = useState("");
  const [pickIssueId, setPickIssueId] = useState("");

  const centerPos = useCallback(() => {
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }, [screenToFlowPosition]);

  const addSticky = () => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "sticky",
        position: pos,
        data: { body: "" },
      },
    ]);
  };

  const addStage = (label: string) => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "stage",
        position: pos,
        data: { label },
      },
    ]);
  };

  const addSketch = () => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "sketch",
        position: pos,
        data: { body: "" },
      },
    ]);
  };

  const addDocRef = () => {
    if (!pickDocId) return;
    const d = docs?.find((x) => x.id === pickDocId);
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "docRef",
        position: pos,
        data: {
          documentId: pickDocId,
          title: d?.title?.trim() || "Untitled",
        },
      },
    ]);
    setDocPickerOpen(false);
    setPickDocId("");
  };

  const addIssueRef = () => {
    if (!pickIssueId) return;
    const i = issues?.find((x) => x.id === pickIssueId);
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "issueRef",
        position: pos,
        data: {
          issueId: pickIssueId,
          identifier: i?.identifier ?? null,
          title: i?.title ?? "",
        },
      },
    ]);
    setIssuePickerOpen(false);
    setPickIssueId("");
  };

  const clearBoard = () => {
    if (!confirm("Remove all nodes and edges from this canvas? (Stored only in this browser.)")) return;
    clearCompanyCanvas(companyId);
    setNodes([]);
    setEdges([]);
  };

  return (
    <>
      <Panel position="top-center" className="m-0 w-full max-w-none">
        <div className="mx-auto flex flex-wrap items-center justify-center gap-2 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">Project canvas</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Pan/zoom · drag between handles to connect
          </span>
          <div className="flex w-full flex-wrap items-center justify-center gap-1 sm:ml-auto sm:w-auto">
            <Button size="sm" variant="outline" onClick={addSticky}>
              <StickyNote className="mr-1 h-3.5 w-3.5" />
              Note
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDocPickerOpen(true)}>
              <FileText className="mr-1 h-3.5 w-3.5" />
              Document
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIssuePickerOpen(true)}>
              <GitBranch className="mr-1 h-3.5 w-3.5" />
              Issue
            </Button>
            <Button size="sm" variant="outline" onClick={addSketch}>
              <PenLine className="mr-1 h-3.5 w-3.5" />
              Sketch
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addStage("PDR")}>
              + PDR
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addStage("CDR")}>
              + CDR
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addStage("TRR")}>
              + TRR
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={clearBoard}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </Panel>

      <Dialog open={docPickerOpen} onOpenChange={setDocPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document card</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pick-doc">Document</Label>
            <select
              id="pick-doc"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pickDocId}
              onChange={(e) => setPickDocId(e.target.value)}
            >
              <option value="">Select…</option>
              {(docs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.title?.trim() || "Untitled").slice(0, 80)}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocPickerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addDocRef} disabled={!pickDocId}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issuePickerOpen} onOpenChange={setIssuePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add issue card</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pick-issue">Issue</Label>
            <select
              id="pick-issue"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pickIssueId}
              onChange={(e) => setPickIssueId(e.target.value)}
            >
              <option value="">Select…</option>
              {(issues ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.identifier} — {i.title}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssuePickerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addIssueRef} disabled={!pickIssueId}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CompanyCanvasBoard() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId!;
  const initial = useMemo(() => loadCompanyCanvas(companyId), [companyId]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const { data: docs } = useQuery({
    queryKey: queryKeys.companyDocuments.list(companyId),
    queryFn: () => documentsApi.list(companyId),
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveCompanyCanvas(companyId, { nodes, edges });
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [companyId, nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: "smoothstep", animated: true }, eds));
    },
    [setEdges],
  );

  return (
    <div className="flex h-[min(85vh,calc(100vh-10rem))] min-h-[420px] w-full flex-col rounded-lg border border-border bg-muted/20">
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.15}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[length:20px_20px]"
        >
          <CanvasToolbar
            companyId={companyId}
            setNodes={setNodes}
            setEdges={setEdges}
            docs={docs}
            issues={issues}
          />
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap zoomable pannable className="!bg-card" />
          <Panel position="bottom-left" className="m-2 max-w-sm rounded-md border border-border bg-card/95 px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm">
            Stored in this browser only (MVP). Canvas nodes + edges match ProjectPlan direction (PLC lifecycle,
            docs, issues); server-backed canvas sync is a later phase.
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
