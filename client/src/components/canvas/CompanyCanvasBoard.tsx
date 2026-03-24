/**
 * React Flow node type map for canvas documents (`DocumentCanvasEditor`) and shared node implementations.
 * Legacy per-company canvas page removed — use a **canvas** company document instead.
 */
import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handle, Position, useReactFlow, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "@/lib/router";
import { FileText, FileType2, GitBranch, PenLine, CheckSquare, BookOpen, ListChecks, Blocks } from "lucide-react";
import { MermaidDiagram } from "../MermaidDiagram";
import { documentsApi } from "../../api/documents";
import { issuesApi } from "../../api/issues";
import { softwareFactoryApi, type SfRequirement, type SfBlueprint, type SfWorkOrder } from "../../api/software-factory";
import { useCompany } from "../../context/CompanyContext";
import { queryKeys } from "../../lib/queryKeys";
import { Input } from "@/components/ui/input";
import { DocPageCanvasNode } from "./DocPageCanvasNode";
import { useCanvasChrome } from "./canvas-chrome-context";
import { CanvasPlateMarkdownCard } from "./CanvasPlateMarkdownCard";
import { hashMarkdownBootstrapKey } from "./canvasMarkdownBootstrapKey";
import { getProseBody } from "../../lib/documentContent";
import { cn } from "@/lib/utils";
import { aggregatePlcStageFromWorkOrders } from "../../lib/canvasGraph";

type StickyData = { body: string };
type DocRefData = { documentId: string; title: string };
type IssueRefData = { issueId: string; identifier: string | null; title: string };
type RequirementRefData = { requirementId: string; title: string; excerpt: string };
type BlueprintRefData = { blueprintId: string; title: string; excerpt: string };
type WorkOrderRefData = { workOrderId: string; title: string; status: string; plcStageId: string | null };

const REF_CARD_W = 360;

const noopMarkdownChange = () => {};
type StageData = { label: string };
type SketchData = { body: string };
type FrameData = { label: string };
type MermaidData = { source: string; title?: string };

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

function RequirementRefNodeInner({ data }: NodeProps<Node<RequirementRefData, "requirementRef">>) {
  const { selectedCompanyId } = useCompany();
  const { wikilinkMentionResolveDocumentId } = useCanvasChrome();
  const { data: req, isLoading } = useQuery({
    queryKey: ["sf-requirement", selectedCompanyId, data.requirementId],
    queryFn: () => softwareFactoryApi.getRequirement(selectedCompanyId!, data.requirementId),
    enabled: Boolean(selectedCompanyId && data.requirementId),
    staleTime: 60_000,
  });

  const excerpt = req?.bodyMd ?? data.excerpt ?? "";
  const reloadKey = useMemo(() => hashMarkdownBootstrapKey(excerpt), [excerpt]);
  const title = (req?.title ?? data.title)?.trim() || "Untitled requirement";

  const markdown = useMemo(() => {
    if (isLoading && !req) return "_Loading…_";
    if (!excerpt.trim()) return "_No description._";
    return excerpt.slice(0, 300) + (excerpt.length > 300 ? "…" : "");
  }, [isLoading, req, excerpt]);

  return (
    <div
      className={cn(
        "relative max-w-[calc(100vw-2rem)] select-none rounded-xl border border-emerald-500/35 bg-card shadow-md ring-1 ring-emerald-500/15 dark:ring-emerald-400/20",
        "flex flex-col overflow-visible",
      )}
      style={{ width: REF_CARD_W }}
    >
      <Handle type="target" position={Position.Left} className="!border-border !bg-muted" />
      <div className="flex shrink-0 items-center gap-2 border-b border-emerald-500/25 bg-emerald-500/[0.07] px-2 py-2 pr-1 dark:bg-emerald-950/30">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/60">
          <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Requirement
          </div>
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={title}>
            {title}
          </p>
        </div>
      </div>
      <div className="min-w-0 bg-background/95">
        <div className="nodrag min-w-0 max-w-full overflow-visible px-1.5 py-1">
          <CanvasPlateMarkdownCard
            key={`reqref-${data.requirementId}-${reloadKey}`}
            documentId={`req-${data.requirementId}`}
            reloadKey={reloadKey}
            markdown={markdown}
            readOnly
            onMarkdownChange={() => {}}
            wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!border-border !bg-muted" />
    </div>
  );
}
const RequirementRefNode = memo(RequirementRefNodeInner);

function BlueprintRefNodeInner({ data }: NodeProps<Node<BlueprintRefData, "blueprintRef">>) {
  const { selectedCompanyId } = useCompany();
  const { wikilinkMentionResolveDocumentId } = useCanvasChrome();
  const { data: bp, isLoading } = useQuery({
    queryKey: ["sf-blueprint", selectedCompanyId, data.blueprintId],
    queryFn: () => softwareFactoryApi.getBlueprint(selectedCompanyId!, data.blueprintId),
    enabled: Boolean(selectedCompanyId && data.blueprintId),
    staleTime: 60_000,
  });

  const excerpt = (bp?.bodyMd ?? data.excerpt) ?? "";
  const reloadKey = useMemo(() => hashMarkdownBootstrapKey(excerpt), [excerpt]);
  const title = (bp?.title ?? data.title)?.trim() || "Untitled blueprint";

  const markdown = useMemo(() => {
    if (isLoading && !bp) return "_Loading…_";
    if (!excerpt.trim()) return "_No description._";
    return excerpt.slice(0, 300) + (excerpt.length > 300 ? "…" : "");
  }, [isLoading, bp, excerpt]);

  return (
    <div
      className={cn(
        "relative max-w-[calc(100vw-2rem)] select-none rounded-xl border border-blue-500/35 bg-card shadow-md ring-1 ring-blue-500/15 dark:ring-blue-400/20",
        "flex flex-col overflow-visible",
      )}
      style={{ width: REF_CARD_W }}
    >
      <Handle type="target" position={Position.Left} className="!border-border !bg-muted" />
      <div className="flex shrink-0 items-center gap-2 border-b border-blue-500/25 bg-blue-500/[0.07] px-2 py-2 pr-1 dark:bg-blue-950/30">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/60">
          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Blueprint
          </div>
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={title}>
            {title}
          </p>
        </div>
      </div>
      <div className="min-w-0 bg-background/95">
        <div className="nodrag min-w-0 max-w-full overflow-visible px-1.5 py-1">
          <CanvasPlateMarkdownCard
            key={`bpref-${data.blueprintId}-${reloadKey}`}
            documentId={`bp-${data.blueprintId}`}
            reloadKey={reloadKey}
            markdown={markdown}
            readOnly
            onMarkdownChange={() => {}}
            wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!border-border !bg-muted" />
    </div>
  );
}
const BlueprintRefNode = memo(BlueprintRefNodeInner);

function WorkOrderRefNodeInner({ data }: NodeProps<Node<WorkOrderRefData, "workOrderRef">>) {
  const { selectedCompanyId } = useCompany();
  const { wikilinkMentionResolveDocumentId } = useCanvasChrome();
  const { data: wo, isLoading } = useQuery({
    queryKey: ["sf-workorder", selectedCompanyId, data.workOrderId],
    queryFn: () => softwareFactoryApi.getWorkOrder(selectedCompanyId!, data.workOrderId),
    enabled: Boolean(selectedCompanyId && data.workOrderId),
    staleTime: 30_000,
  });

  const excerpt = (wo?.descriptionMd ?? "")?.trim() || data.status;
  const reloadKey = useMemo(() => hashMarkdownBootstrapKey(excerpt), [excerpt]);
  const title = (wo?.title ?? data.title)?.trim() || "Untitled work order";
  const status = wo?.status ?? data.status ?? "backlog";

  const statusColors: Record<string, string> = {
    backlog: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
    blocked: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  };
  const colorClass = statusColors[status] ?? statusColors.backlog;

  const markdown = useMemo(() => {
    if (isLoading && !wo) return "_Loading…_";
    if (!excerpt.trim()) return `_Status: ${status}_`;
    return excerpt.slice(0, 300) + (excerpt.length > 300 ? "…" : "");
  }, [isLoading, wo, excerpt, status]);

  return (
    <div
      className={cn(
        "relative max-w-[calc(100vw-2rem)] select-none rounded-xl border border-orange-500/35 bg-card shadow-md ring-1 ring-orange-500/15 dark:ring-orange-400/20",
        "flex flex-col overflow-visible",
      )}
      style={{ width: REF_CARD_W }}
    >
      <Handle type="target" position={Position.Left} className="!border-border !bg-muted" />
      <div className="flex shrink-0 items-center gap-2 border-b border-orange-500/25 bg-orange-500/[0.07] px-2 py-2 pr-1 dark:bg-orange-950/30">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/60">
          <ListChecks className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
            Work Order
          </div>
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={title}>
            {title}
          </p>
          <span className={cn("mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", colorClass)}>
            {status.replace("_", " ")}
          </span>
        </div>
      </div>
      <div className="min-w-0 bg-background/95">
        <div className="nodrag min-w-0 max-w-full overflow-visible px-1.5 py-1">
          <CanvasPlateMarkdownCard
            key={`woref-${data.workOrderId}-${reloadKey}`}
            documentId={`wo-${data.workOrderId}`}
            reloadKey={reloadKey}
            markdown={markdown}
            readOnly
            onMarkdownChange={() => {}}
            wikilinkMentionResolveDocumentId={wikilinkMentionResolveDocumentId}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!border-border !bg-muted" />
    </div>
  );
}
const WorkOrderRefNode = memo(WorkOrderRefNodeInner);

function StageNodeInner({ id, data }: NodeProps<Node<StageData, "stage">>) {
  const { setNodes } = useReactFlow();
  const { projectWorkOrders } = useCanvasChrome();
  const agg = useMemo(
    () => aggregatePlcStageFromWorkOrders(projectWorkOrders, id),
    [projectWorkOrders, id],
  );
  const shellClass = cn(
    "min-w-[140px] rounded-full border-2 px-4 py-2 text-center shadow-sm transition-colors",
    agg.kind === "empty" && "border-dashed border-sky-500/50 bg-sky-500/10",
    agg.kind === "active" && "border-solid border-blue-500/65 bg-blue-500/12 dark:bg-blue-950/35",
    agg.kind === "blocked" && "border-solid border-amber-600/75 bg-amber-500/12 dark:bg-amber-950/40",
    agg.kind === "complete" && "border-solid border-emerald-600/70 bg-emerald-500/10 dark:bg-emerald-950/35",
  );
  const statusLabel =
    agg.kind === "empty"
      ? "No work orders"
      : agg.kind === "active"
        ? `In flight · ${agg.count}`
        : agg.kind === "blocked"
          ? `Blocked · ${agg.count}`
          : `Complete · ${agg.count}`;
  return (
    <div className={shellClass}>
      <Handle type="target" position={Position.Top} />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">PLC stage</div>
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
      <p className="mt-0.5 text-[10px] font-medium tabular-nums text-muted-foreground" title="From work orders with this PLC stage">
        {statusLabel}
      </p>
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

function MermaidNodeInner({ id, data }: NodeProps<Node<MermaidData, "mermaid">>) {
  const { setNodes } = useReactFlow();
  return (
    <div className="w-[380px] rounded-xl border-2 border-indigo-300/70 bg-card shadow-sm dark:border-indigo-700/50 dark:bg-card/80">
      <Handle type="target" position={Position.Left} className="!bg-indigo-500" />
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2">
        <Blocks className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <input
          className="nodrag nopan min-w-0 flex-1 bg-transparent text-[11px] font-semibold uppercase tracking-wide text-indigo-600 placeholder:text-indigo-400 outline-none dark:text-indigo-300"
          value={data.title ?? ""}
          placeholder="DIAGRAM"
          onChange={(e) =>
            setNodes((nds) =>
              nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, title: e.target.value } } : n)),
            )
          }
        />
      </div>
      <div className="max-h-[360px] overflow-auto p-1">
        <MermaidDiagram source={data.source} className="[&_.paperclip-mermaid-status]:text-xs" />
      </div>
      <textarea
        className="nodrag nopan w-full resize-none border-t border-border/50 bg-muted/30 p-2 text-xs font-mono text-muted-foreground outline-none focus:bg-muted/50"
        value={data.source}
        placeholder="graph TD&#10;  A[Start] --> B[End]"
        rows={4}
        onChange={(e) =>
          setNodes((nds) =>
            nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, source: e.target.value } } : n)),
          )
        }
      />
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </div>
  );
}
const MermaidNode = memo(MermaidNodeInner);

export const hypoworkCanvasNodeTypes: NodeTypes = {
  sticky: StickyNode,
  docPage: DocPageCanvasNode,
  docRef: DocRefNode,
  issueRef: IssueRefNode,
  requirementRef: RequirementRefNode,
  blueprintRef: BlueprintRefNode,
  workOrderRef: WorkOrderRefNode,
  stage: StageNode,
  sketch: SketchNode,
  frame: FrameNode,
  mermaid: MermaidNode,
};
