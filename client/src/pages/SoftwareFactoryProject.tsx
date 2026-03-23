import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChartGantt,
  Columns3,
  ExternalLink,
  Factory,
  List,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Table2,
} from "lucide-react";
import { isUuidLike } from "@paperclipai/shared";
import { softwareFactoryApi, type SfWorkOrder } from "../api/software-factory";
import { projectsApi } from "../api/projects";
import { documentsApi } from "../api/documents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { DocumentLinkPickerProvider } from "../context/DocumentLinkPickerContext";
import { queryKeys } from "../lib/queryKeys";
import { projectRouteRef, cn } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { PlateFullKitMarkdownDocumentEditor } from "../components/PlateEditor/PlateFullKitMarkdownDocumentEditor";
import { MermaidDiagram } from "../components/MermaidDiagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PlannerGanttFromPort,
  PlannerKanbanFromPort,
  PlannerTableFromPort,
} from "@/components/software-factory/PlannerBoardViews";
import { buildPlannerGanttPort, buildPlannerKanbanPort } from "@/ports/software-factory-planner";

const WO_STATUSES = ["todo", "in_progress", "done", "blocked", "cancelled"] as const;

type FactoryTab = "refinery" | "foundry" | "planner" | "validator";

/** Matches project Issues list / board pattern; persisted per company + project. */
type PlannerViewMode = "list" | "board" | "gantt" | "table";

function isPlannerViewMode(v: string | null): v is PlannerViewMode {
  return v === "list" || v === "board" || v === "gantt" || v === "table";
}

/** Stable id so `@` / wikilink picker can exclude a non-document “current” note. */
const FACTORY_PICKER_SENTINEL_DOC = "f0000000-0000-4000-8000-000000000001";

const AUTOSAVE_MS = 1800;

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function SfWorkOrderMetaPanel({
  workOrder,
  companyPrefix,
  patchWorkOrderMut,
  trackOnIssuesMut,
}: {
  workOrder: SfWorkOrder;
  companyPrefix?: string;
  patchWorkOrderMut: {
    mutate: (args: {
      id: string;
      patch: Partial<{
        plannedStartAt: string | null;
        plannedEndAt: string | null;
      }>;
    }) => void;
    isPending: boolean;
  };
  trackOnIssuesMut: { mutate: (wo: SfWorkOrder) => void; isPending: boolean };
}) {
  const issueHref = workOrder.linkedIssueId
    ? companyPrefix
      ? `/${companyPrefix}/issues/${workOrder.linkedIssueId}`
      : `/issues/${workOrder.linkedIssueId}`
    : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3 text-sm shrink-0">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 block min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground">Planned start</span>
          <input
            type="datetime-local"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            defaultValue={toDatetimeLocalValue(workOrder.plannedStartAt)}
            key={`ps-${workOrder.id}-${workOrder.plannedStartAt ?? ""}-${workOrder.updatedAt}`}
            disabled={patchWorkOrderMut.isPending}
            onBlur={(e) => {
              const iso = fromDatetimeLocalValue(e.target.value);
              const cur = workOrder.plannedStartAt;
              const same =
                (iso == null && cur == null) ||
                (iso != null &&
                  cur != null &&
                  Math.abs(new Date(iso).getTime() - new Date(cur).getTime()) < 1000);
              if (same) return;
              patchWorkOrderMut.mutate({ id: workOrder.id, patch: { plannedStartAt: iso } });
            }}
          />
        </label>
        <label className="space-y-1 block min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground">Planned end</span>
          <input
            type="datetime-local"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            defaultValue={toDatetimeLocalValue(workOrder.plannedEndAt)}
            key={`pe-${workOrder.id}-${workOrder.plannedEndAt ?? ""}-${workOrder.updatedAt}`}
            disabled={patchWorkOrderMut.isPending}
            onBlur={(e) => {
              const iso = fromDatetimeLocalValue(e.target.value);
              const cur = workOrder.plannedEndAt;
              const same =
                (iso == null && cur == null) ||
                (iso != null &&
                  cur != null &&
                  Math.abs(new Date(iso).getTime() - new Date(cur).getTime()) < 1000);
              if (same) return;
              patchWorkOrderMut.mutate({ id: workOrder.id, patch: { plannedEndAt: iso } });
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {issueHref ? (
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to={issueHref} target="_blank" rel="noreferrer">
              Open linked issue
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={trackOnIssuesMut.isPending}
            onClick={() => trackOnIssuesMut.mutate(workOrder)}
          >
            Track on Issues
          </Button>
        )}
      </div>
    </div>
  );
}

function FactoryAssistPanel({
  tab,
  projectName,
  projectUuid,
}: {
  tab: FactoryTab;
  projectName: string;
  projectUuid: string;
}) {
  const chatHref = `/chat?project=${encodeURIComponent(projectUuid)}`;

  const byTab: Record<
    FactoryTab,
    {
      title: string;
      purpose: string;
      expectations: string;
      checklist: string[];
      prompts: string[];
    }
  > = {
    refinery: {
      title: "Refinery — requirements",
      purpose:
        "Turn fuzzy intent into testable statements of what the product must do. This is the contract before anyone designs systems or tasks.",
      expectations:
        "Each requirement should be understandable by a new teammate: who it helps, what behavior they see, and what “good” looks like. Prefer concrete nouns and measurable outcomes over buzzwords.",
      checklist: [
        "User-visible behavior, inputs/outputs, and edge cases.",
        "Constraints: performance, security, compliance, platforms.",
        "Acceptance signals: demos, metrics, or checklist items.",
        "Optional YAML for priority, epic, risk, or trace IDs.",
      ],
      prompts: [
        `List ambiguous terms in these requirements for “${projectName}”.`,
        "Propose acceptance criteria as bullet list from the markdown body.",
        "Summarize conflicts between stated constraints.",
      ],
    },
    foundry: {
      title: "Foundry — blueprints",
      purpose:
        "Describe how the system satisfies requirements: structure, boundaries, data flow, and failure behavior. Blueprints bridge “what” (Refinery) and “who does what” (Planner).",
      expectations:
        "Name major components and their responsibilities. Call out interfaces (APIs, events, DB). Use the Mermaid field for flows topologies; use markdown for ADR-style rationale and tradeoffs.",
      checklist: [
        "Components, boundaries, and trust zones.",
        "Interfaces and failure modes (timeouts, retries, partial outages).",
        "Diagram: sequence, flowchart, or C4-style in Mermaid.",
        "Link back to requirements via the checklist on each blueprint.",
      ],
      prompts: [
        "Draft a C4-style breakdown from the requirement list (assume context in chat).",
        "Identify missing failure-mode coverage vs requirements.",
        "Suggest a Mermaid diagram for service boundaries.",
      ],
    },
    planner: {
      title: "Planner — work orders",
      purpose:
        "Break delivery into small, shippable slices with clear owners and done-when criteria. Work orders are what humans or agents actually execute.",
      expectations:
        "One primary outcome per work order. Description should read like a brief: scope, dependencies, and how we know it’s finished. Status should reflect reality for standups and automation.",
      checklist: [
        "Title + markdown description: outcome, scope, done-when.",
        "Status reflects real progress; use blocked when waiting on external input.",
        "Dependencies on other work orders (shown on cards / Gantt footnote).",
        "Validator can spawn work orders from CI/review failures.",
        "Planner views mirror project Issues: List, Board (Kanban), Timeline (Gantt), Table.",
      ],
      prompts: [
        "Break the open blueprint into ordered work orders with dependencies.",
        "What is likely blocking `in_progress` items for this project?",
        "Rewrite descriptions as checklists with clear done criteria.",
      ],
    },
    validator: {
      title: "Validator — feedback",
      purpose:
        "Capture reality from CI, reviews, or incidents in a structured way so Planner can react. This is the feedback loop from execution back into the factory.",
      expectations:
        "Record enough context to reproduce or triage: source, short summary, and a JSON payload with URLs, job names, or excerpts. Prefer facts over narrative; link or paste logs in the payload when useful.",
      checklist: [
        "Source tag: ci, review, manual, staging, etc.",
        "Summary line humans scan; JSON holds structured detail.",
        "Optional: auto-create a work order for triage.",
        "Feeds Planner and future “suggest fix” agents.",
      ],
      prompts: [
        "Classify this validation payload: flake vs real defect vs infra.",
        "Propose a work order title and description from the CI log.",
        "List which requirements or blueprints this failure most likely touches.",
      ],
    },
  };

  const cfg = byTab[tab];

  return (
    <aside className="lg:w-72 shrink-0 space-y-4 rounded-lg border border-border bg-muted/15 p-4 text-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guide</h3>
        <p className="mt-1 font-medium text-foreground">{cfg.title}</p>
        <p className="mt-2 text-muted-foreground leading-relaxed">{cfg.purpose}</p>
        <p className="mt-2 text-xs font-medium text-foreground">What good input looks like</p>
        <p className="mt-1 text-muted-foreground leading-relaxed">{cfg.expectations}</p>
        <p className="mt-3 text-xs font-medium text-foreground">Checklist</p>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
          {cfg.checklist.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try in chat</p>
        <ul className="mt-2 space-y-1.5 text-muted-foreground">
          {cfg.prompts.map((p) => (
            <li key={p} className="rounded-md bg-background/60 px-2 py-1.5 text-xs leading-snug">
              {p}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-3 w-full gap-2" asChild>
          <Link to={chatHref}>
            <MessageCircle className="h-3.5 w-3.5" />
            Open company chat
          </Link>
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Opens chat with <span className="font-mono">?project=…</span> so new threads include factory RAG (requirements,
          blueprints, work orders, validation) plus project-tagged company notes.
        </p>
      </div>
    </aside>
  );
}

export function SoftwareFactoryProjectPanel({ embedded = false }: { embedded?: boolean }) {
  const { companyPrefix, projectId: routeProjectRef } = useParams<{
    companyPrefix?: string;
    projectId: string;
  }>();
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FactoryTab>("refinery");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [editorBootNonce, setEditorBootNonce] = useState(0);
  const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>("list");

  const routeCompanyId = useMemo(() => {
    if (!companyPrefix) return null;
    const p = companyPrefix.toUpperCase();
    return companies.find((c) => c.issuePrefix.toUpperCase() === p)?.id ?? null;
  }, [companies, companyPrefix]);

  const lookupCompanyId = routeCompanyId ?? selectedCompanyId ?? undefined;
  const canFetchProject = Boolean(routeProjectRef) && (isUuidLike(routeProjectRef) || Boolean(lookupCompanyId));

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [...queryKeys.projects.detail(routeProjectRef ?? ""), lookupCompanyId ?? null],
    queryFn: () => projectsApi.get(routeProjectRef!, lookupCompanyId),
    enabled: canFetchProject && Boolean(routeProjectRef),
  });

  const companyId = project?.companyId ?? selectedCompanyId;
  const canonicalProjectRef = project ? projectRouteRef(project) : routeProjectRef;
  const projectUuid = project?.id ?? (isUuidLike(routeProjectRef) ? routeProjectRef : null);

  const plannerViewStorageKey =
    companyId && projectUuid ? `paperclip:sf-planner-view:${companyId}:${projectUuid}` : null;

  useEffect(() => {
    if (!plannerViewStorageKey) return;
    try {
      const raw = localStorage.getItem(plannerViewStorageKey);
      if (isPlannerViewMode(raw)) setPlannerViewMode(raw);
    } catch {
      /* ignore */
    }
  }, [plannerViewStorageKey]);

  const updatePlannerViewMode = useCallback(
    (mode: PlannerViewMode) => {
      setPlannerViewMode(mode);
      if (plannerViewStorageKey) {
        try {
          localStorage.setItem(plannerViewStorageKey, mode);
        } catch {
          /* ignore */
        }
      }
    },
    [plannerViewStorageKey],
  );

  const { data: pickerDocuments } = useQuery({
    queryKey: queryKeys.companyDocuments.list(companyId ?? "__none__"),
    queryFn: () => documentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const resolveWikilinkMentionDocumentId = useCallback(
    (wikilinkTitle: string) => {
      const t = wikilinkTitle.trim().toLowerCase();
      for (const d of pickerDocuments ?? []) {
        if ((d.title ?? "").trim().toLowerCase() === t) return d.id;
      }
      return null;
    },
    [pickerDocuments],
  );

  const documentLinkPickerValue =
    pickerDocuments && companyId
      ? {
          documents: pickerDocuments.map((d) => ({ id: d.id, title: d.title })),
          currentDocumentId: FACTORY_PICKER_SENTINEL_DOC,
        }
      : null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (!project?.companyId || project.companyId === selectedCompanyId) return;
    setSelectedCompanyId(project.companyId, { source: "route_sync" });
  }, [project?.companyId, selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    if (embedded) return;
    setBreadcrumbs([
      { label: "Projects", href: "/projects" },
      { label: project?.name ?? routeProjectRef ?? "Project", href: `/projects/${canonicalProjectRef}/issues` },
      { label: "Design factory" },
    ]);
  }, [embedded, setBreadcrumbs, project?.name, routeProjectRef, canonicalProjectRef]);

  const searchQuery = useQuery({
    queryKey: queryKeys.softwareFactory.search(companyId ?? "__none__", debouncedQ),
    queryFn: () => softwareFactoryApi.search(companyId!, debouncedQ, 30),
    enabled: !!companyId && debouncedQ.length > 0,
  });

  const requirementsQuery = useQuery({
    queryKey: queryKeys.softwareFactory.requirements(companyId ?? "__none__", projectUuid ?? "__none__"),
    queryFn: () => softwareFactoryApi.listRequirements(companyId!, projectUuid!),
    enabled: !!companyId && !!projectUuid,
  });

  const blueprintsQuery = useQuery({
    queryKey: queryKeys.softwareFactory.blueprints(companyId ?? "__none__", projectUuid ?? "__none__"),
    queryFn: () => softwareFactoryApi.listBlueprints(companyId!, projectUuid!),
    enabled: !!companyId && !!projectUuid,
  });

  const workOrdersQuery = useQuery({
    queryKey: queryKeys.softwareFactory.workOrders(companyId ?? "__none__", projectUuid ?? "__none__"),
    queryFn: () => softwareFactoryApi.listWorkOrders(companyId!, projectUuid!),
    enabled: !!companyId && !!projectUuid,
  });

  const validationQuery = useQuery({
    queryKey: queryKeys.softwareFactory.validationEvents(companyId ?? "__none__", projectUuid ?? "__none__"),
    queryFn: () => softwareFactoryApi.listValidationEvents(companyId!, projectUuid!),
    enabled: !!companyId && !!projectUuid,
  });

  const requirementsList = requirementsQuery.data ?? [];
  const blueprintsList = blueprintsQuery.data ?? [];
  const workOrdersList = workOrdersQuery.data ?? [];
  const validationList = validationQuery.data ?? [];

  const invalidateSf = useCallback(() => {
    if (!companyId || !projectUuid) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.softwareFactory.requirements(companyId, projectUuid),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.softwareFactory.blueprints(companyId, projectUuid),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.softwareFactory.workOrders(companyId, projectUuid),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.softwareFactory.validationEvents(companyId, projectUuid),
    });
  }, [companyId, projectUuid, queryClient]);

  const patchRequirementMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; bodyMd?: string; structuredYaml?: string | null };
    }) => softwareFactoryApi.patchRequirement(companyId!, id, patch),
    onSuccess: invalidateSf,
  });

  const patchBlueprintMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        title?: string;
        bodyMd?: string;
        diagramMermaid?: string | null;
        linkedRequirementIds?: string[];
      };
    }) => softwareFactoryApi.patchBlueprint(companyId!, id, patch),
    onSuccess: invalidateSf,
  });

  const patchWorkOrderMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        title: string;
        descriptionMd: string;
        status: string;
        linkedIssueId: string | null;
        plannedStartAt: string | null;
        plannedEndAt: string | null;
      }>;
    }) => softwareFactoryApi.patchWorkOrder(companyId!, id, patch),
    onSuccess: invalidateSf,
  });

  const reqBodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqYamlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bpBodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bpMermaidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const woDescTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      for (const t of [reqBodyTimer, reqYamlTimer, bpBodyTimer, bpMermaidTimer, woDescTimer]) {
        if (t.current) clearTimeout(t.current);
      }
    };
  }, []);

  const scheduleReqBody = (id: string, bodyMd: string) => {
    if (reqBodyTimer.current) clearTimeout(reqBodyTimer.current);
    reqBodyTimer.current = setTimeout(() => {
      reqBodyTimer.current = null;
      patchRequirementMut.mutate({ id, patch: { bodyMd } });
    }, AUTOSAVE_MS);
  };

  const scheduleReqYaml = (id: string, structuredYaml: string | null) => {
    if (reqYamlTimer.current) clearTimeout(reqYamlTimer.current);
    reqYamlTimer.current = setTimeout(() => {
      reqYamlTimer.current = null;
      patchRequirementMut.mutate({ id, patch: { structuredYaml } });
    }, AUTOSAVE_MS);
  };

  const scheduleBpBody = (id: string, bodyMd: string) => {
    if (bpBodyTimer.current) clearTimeout(bpBodyTimer.current);
    bpBodyTimer.current = setTimeout(() => {
      bpBodyTimer.current = null;
      patchBlueprintMut.mutate({ id, patch: { bodyMd } });
    }, AUTOSAVE_MS);
  };

  const scheduleBpMermaid = (id: string, diagramMermaid: string | null) => {
    if (bpMermaidTimer.current) clearTimeout(bpMermaidTimer.current);
    bpMermaidTimer.current = setTimeout(() => {
      bpMermaidTimer.current = null;
      patchBlueprintMut.mutate({ id, patch: { diagramMermaid } });
    }, AUTOSAVE_MS);
  };

  const scheduleWoDesc = (id: string, descriptionMd: string) => {
    if (woDescTimer.current) clearTimeout(woDescTimer.current);
    woDescTimer.current = setTimeout(() => {
      woDescTimer.current = null;
      patchWorkOrderMut.mutate({ id, patch: { descriptionMd } });
    }, AUTOSAVE_MS);
  };

  const [newReqTitle, setNewReqTitle] = useState("");
  const [newReqBody, setNewReqBody] = useState("");
  const [newReqYaml, setNewReqYaml] = useState("");

  const createReq = useMutation({
    mutationFn: () =>
      softwareFactoryApi.createRequirement(companyId!, projectUuid!, {
        title: newReqTitle.trim() || "Untitled requirement",
        bodyMd: newReqBody,
        structuredYaml: newReqYaml.trim() ? newReqYaml : null,
      }),
    onSuccess: (row) => {
      setNewReqTitle("");
      setNewReqBody("");
      setNewReqYaml("");
      setSelectedRequirementId(row.id);
      setEditorBootNonce((n) => n + 1);
      invalidateSf();
    },
  });

  const [newBpTitle, setNewBpTitle] = useState("");
  const [newBpBody, setNewBpBody] = useState("");
  const [newBpMermaid, setNewBpMermaid] = useState("");

  const createBp = useMutation({
    mutationFn: () =>
      softwareFactoryApi.createBlueprint(companyId!, projectUuid!, {
        title: newBpTitle.trim() || "Untitled blueprint",
        bodyMd: newBpBody,
        diagramMermaid: newBpMermaid.trim() ? newBpMermaid : null,
      }),
    onSuccess: (row) => {
      setNewBpTitle("");
      setNewBpBody("");
      setNewBpMermaid("");
      setSelectedBlueprintId(row.id);
      setEditorBootNonce((n) => n + 1);
      invalidateSf();
    },
  });

  const [newWoTitle, setNewWoTitle] = useState("");
  const [newWoDesc, setNewWoDesc] = useState("");

  const createWo = useMutation({
    mutationFn: () =>
      softwareFactoryApi.createWorkOrder(companyId!, projectUuid!, {
        title: newWoTitle.trim() || "Untitled work order",
        descriptionMd: newWoDesc,
      }),
    onSuccess: (row) => {
      setNewWoTitle("");
      setNewWoDesc("");
      setSelectedWorkOrderId(row.id);
      setEditorBootNonce((n) => n + 1);
      invalidateSf();
    },
  });

  const [valSource, setValSource] = useState("ci");
  const [valSummary, setValSummary] = useState("");
  const [valPayload, setValPayload] = useState("{}");
  const [valSpawnWo, setValSpawnWo] = useState(true);

  const createVal = useMutation({
    mutationFn: () => {
      let rawPayload: Record<string, unknown> = {};
      try {
        rawPayload = JSON.parse(valPayload || "{}") as Record<string, unknown>;
      } catch {
        rawPayload = { raw: valPayload };
      }
      return softwareFactoryApi.createValidationEvent(companyId!, projectUuid!, {
        source: valSource.trim() || "manual",
        summary: valSummary.trim() || null,
        rawPayload,
        createWorkOrder: valSpawnWo,
        workOrderTitle: valSummary.trim() || undefined,
      });
    },
    onSuccess: () => {
      setValSummary("");
      setValPayload("{}");
      invalidateSf();
    },
  });

  const patchWo = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      softwareFactoryApi.patchWorkOrder(companyId!, id, { status }),
    onSuccess: invalidateSf,
  });

  const trackOnIssuesMut = useMutation({
    mutationFn: async (wo: SfWorkOrder) => {
      const issue = await issuesApi.create(companyId!, {
        projectId: projectUuid!,
        title: `[WO] ${wo.title}`.slice(0, 200),
        description: `Tracked from Design Factory work order (${wo.id}).\n\n---\n\n${wo.descriptionMd ?? ""}`.slice(
          0,
          100_000,
        ),
        status: "backlog",
      });
      await softwareFactoryApi.patchWorkOrder(companyId!, wo.id, { linkedIssueId: issue.id });
      return issue;
    },
    onSuccess: (issue) => {
      invalidateSf();
      if (companyId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
      }
      if (companyId && projectUuid) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.issues.listByProject(companyId, projectUuid),
        });
      }
      pushToast({
        title: `Linked to issue ${issue.identifier ?? issue.id}`,
        tone: "success",
      });
    },
    onError: (e: Error) => {
      pushToast({ title: e.message || "Could not create issue", tone: "error" });
    },
  });

  const designAssistMut = useMutation({
    mutationFn: (body: { validationEventId?: string; fromOpenRequirements?: boolean }) =>
      softwareFactoryApi.designAssistSuggestions(companyId!, projectUuid!, body),
    onError: (e: Error) => {
      pushToast({ title: e.message || "Design assist failed", tone: "error" });
    },
  });

  const createWoFromSuggestionMut = useMutation({
    mutationFn: (s: { title: string; descriptionMd: string }) =>
      softwareFactoryApi.createWorkOrder(companyId!, projectUuid!, {
        title: s.title,
        descriptionMd: s.descriptionMd,
      }),
    onSuccess: (row) => {
      invalidateSf();
      setSelectedWorkOrderId(row.id);
      pushToast({ title: "Work order created", tone: "success" });
    },
    onError: (e: Error) => {
      pushToast({ title: e.message || "Could not create work order", tone: "error" });
    },
  });

  const selectedRequirement = useMemo(
    () => requirementsList.find((r) => r.id === selectedRequirementId) ?? null,
    [requirementsList, selectedRequirementId],
  );

  const selectedBlueprint = useMemo(
    () => blueprintsList.find((b) => b.id === selectedBlueprintId) ?? null,
    [blueprintsList, selectedBlueprintId],
  );

  const selectedWorkOrder = useMemo(
    () => workOrdersList.find((w) => w.id === selectedWorkOrderId) ?? null,
    [workOrdersList, selectedWorkOrderId],
  );

  const plannerKanbanPort = useMemo(
    () => buildPlannerKanbanPort(workOrdersList, WO_STATUSES),
    [workOrdersList],
  );

  const plannerGanttPort = useMemo(
    () => buildPlannerGanttPort(workOrdersList),
    [workOrdersList],
  );

  const [bpMermaidDraft, setBpMermaidDraft] = useState("");
  useEffect(() => {
    if (!selectedBlueprint) {
      setBpMermaidDraft("");
      return;
    }
    setBpMermaidDraft(selectedBlueprint.diagramMermaid ?? "");
  }, [selectedBlueprint?.id, selectedBlueprint?.diagramMermaid]);

  const handleTabChange = (v: string) => {
    setTab(v as FactoryTab);
    setSelectedRequirementId(null);
    setSelectedBlueprintId(null);
    setSelectedWorkOrderId(null);
  };

  const selectRequirement = (id: string) => {
    setSelectedRequirementId((prev) => {
      if (prev !== id) setEditorBootNonce((n) => n + 1);
      return id;
    });
  };

  const selectBlueprint = (id: string) => {
    setSelectedBlueprintId((prev) => {
      if (prev !== id) setEditorBootNonce((n) => n + 1);
      return id;
    });
  };

  const selectWorkOrder = (id: string) => {
    setSelectedWorkOrderId((prev) => {
      if (prev !== id) setEditorBootNonce((n) => n + 1);
      return id;
    });
  };

  const plannerBoardHandlers = {
    onSelectCard: selectWorkOrder,
    selectedWorkOrderId,
  };

  if (!companyId || !lookupCompanyId) {
    return <p className="text-sm text-muted-foreground">Select or open a company to use the software factory.</p>;
  }

  if (projectLoading || !routeProjectRef) {
    return <PageSkeleton variant="detail" />;
  }

  if (!project || !projectUuid || !companyPrefix) {
    return <p className="text-sm text-destructive">Project not found.</p>;
  }

  return (
    <DocumentLinkPickerProvider value={documentLinkPickerValue}>
      <div
        className={cn(
          "mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col space-y-6",
          embedded ? "px-0 pt-0 pb-2 md:pb-4" : "px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6",
        )}
      >
        {embedded ? (
          <p className="text-xs text-muted-foreground shrink-0 leading-relaxed">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
              <Factory className="h-3.5 w-3.5" />
              Design factory
            </span>
            {" — "}
            Refinery, Foundry, Planner, Validator. Same Plate editors as company documents; Mermaid preview in Foundry.
          </p>
        ) : (
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                <Factory className="h-3.5 w-3.5" />
                Design factory
              </div>
              <h1 className="text-xl font-semibold mt-1">{project.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Refinery, Foundry, and Planner use the same Plate full-kit as company documents (single editor per
                item; Mermaid diagram preview beside the blueprint field). Validator uses structured ingest. See{" "}
                <span className="font-mono text-xs">doc/software-foundry.md</span> for the full flow.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/projects/${canonicalProjectRef}/issues`}>Back to project</Link>
            </Button>
          </div>
        )}

        <div className="shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search requirements, blueprints, work orders, validation (this company)…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          {debouncedQ.length > 0 && (searchQuery.data ?? []).length > 0 && (
            <ul className="rounded-md border border-border bg-muted/20 text-sm divide-y divide-border max-h-48 overflow-y-auto">
              {(searchQuery.data ?? []).map((hit) => (
                <li key={`${hit.kind}-${hit.id}`} className="px-3 py-2">
                  <span className="text-muted-foreground text-xs mr-2">{hit.kind}</span>
                  <span className="font-medium">{hit.title}</span>
                  {hit.projectId === projectUuid ? null : (
                    <span className="text-xs text-muted-foreground ml-2">(other project)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {designAssistMut.data?.suggestions && designAssistMut.data.suggestions.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">Suggested work orders (design assist)</p>
                <Button type="button" variant="ghost" size="xs" onClick={() => designAssistMut.reset()}>
                  Clear
                </Button>
              </div>
              <ul className="space-y-2">
                {designAssistMut.data.suggestions.map((s, i) => (
                  <li
                    key={`${s.title}-${i}`}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-2 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.descriptionMd}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      disabled={createWoFromSuggestionMut.isPending}
                      onClick={() => createWoFromSuggestionMut.mutate(s)}
                    >
                      Create WO
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <Tabs value={tab} onValueChange={handleTabChange} className="min-h-0 flex-1">
          <TabsList className="flex flex-wrap h-auto gap-1 shrink-0">
            <TabsTrigger value="refinery">Refinery</TabsTrigger>
            <TabsTrigger value="foundry">Foundry</TabsTrigger>
            <TabsTrigger value="planner">Planner</TabsTrigger>
            <TabsTrigger value="validator">Validator</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
              <TabsContent value="refinery" className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
                <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                  <div className="flex max-h-[min(100%,720px)] min-h-0 w-full shrink-0 flex-col rounded-lg border border-border bg-card/30 p-3 lg:w-72 lg:max-h-none">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirements</p>
                    <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                      {requirementsList.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
                          <p className="text-sm text-foreground">No requirements yet</p>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Start with one clear “must have” before architecture. Use the form below.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-1.5"
                            onClick={() => document.getElementById("sf-new-req-title")?.focus()}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            New requirement
                          </Button>
                        </div>
                      ) : (
                        requirementsList.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectRequirement(r.id)}
                            className={cn(
                              "w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                              selectedRequirementId === r.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <span className="line-clamp-2 font-medium">{r.title}</span>
                            <span className="text-[10px] text-muted-foreground">v{r.version}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Add requirement</p>
                      <Input
                        id="sf-new-req-title"
                        placeholder="Title"
                        value={newReqTitle}
                        onChange={(e) => setNewReqTitle(e.target.value)}
                      />
                      <Textarea
                        placeholder="Markdown body (optional until after create)"
                        value={newReqBody}
                        onChange={(e) => setNewReqBody(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <Textarea
                        placeholder="Structured YAML (optional)"
                        value={newReqYaml}
                        onChange={(e) => setNewReqYaml(e.target.value)}
                        rows={2}
                        className="font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => createReq.mutate()}
                        disabled={createReq.isPending}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add requirement
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={designAssistMut.isPending || requirementsList.length === 0}
                        onClick={() => designAssistMut.mutate({ fromOpenRequirements: true })}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Suggest WOs from requirements
                      </Button>
                    </div>
                  </div>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                    {selectedRequirement ? (
                      <>
                        <Input
                          defaultValue={selectedRequirement.title}
                          key={`rt-${selectedRequirement.id}-${selectedRequirement.updatedAt}`}
                          className="shrink-0 font-medium"
                          onBlur={(e) => {
                            const t = e.target.value.trim();
                            if (t && t !== selectedRequirement.title) {
                              patchRequirementMut.mutate({ id: selectedRequirement.id, patch: { title: t } });
                            }
                          }}
                        />
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
                          <PlateFullKitMarkdownDocumentEditor
                            key={`sf-req-${selectedRequirement.id}-${editorBootNonce}`}
                            companyId={companyId ?? undefined}
                            documentId={`sf-req-${selectedRequirement.id}`}
                            initialMarkdown={selectedRequirement.bodyMd ?? ""}
                            onMarkdownChange={(md) => scheduleReqBody(selectedRequirement.id, md)}
                            editorPlaceholder="Write requirements (full markdown kit)…"
                            wikilinkMentionResolveDocumentId={resolveWikilinkMentionDocumentId}
                            fullBleed
                            className="min-h-0 flex-1 bg-transparent"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Structured YAML</p>
                          <Textarea
                            key={`ry-${selectedRequirement.id}-${selectedRequirement.updatedAt}`}
                            defaultValue={selectedRequirement.structuredYaml ?? ""}
                            className="font-mono text-xs min-h-[100px]"
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              scheduleReqYaml(selectedRequirement.id, v.length ? v : null);
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                        Select a requirement to edit with Plate, or create one.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="foundry" className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
                <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                  <div className="flex max-h-[min(100%,720px)] min-h-0 w-full shrink-0 flex-col rounded-lg border border-border bg-card/30 p-3 lg:w-72 lg:max-h-none">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blueprints</p>
                    <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                      {blueprintsList.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
                          <p className="text-sm text-foreground">No blueprints yet</p>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Capture architecture and diagrams here. Use the form below.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-1.5"
                            onClick={() => document.getElementById("sf-new-bp-title")?.focus()}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            New blueprint
                          </Button>
                        </div>
                      ) : (
                        blueprintsList.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => selectBlueprint(b.id)}
                            className={cn(
                              "w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                              selectedBlueprintId === b.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <span className="line-clamp-2 font-medium">{b.title}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Add blueprint</p>
                      <Input
                        id="sf-new-bp-title"
                        placeholder="Title"
                        value={newBpTitle}
                        onChange={(e) => setNewBpTitle(e.target.value)}
                      />
                      <Textarea
                        placeholder="Initial markdown (optional)"
                        value={newBpBody}
                        onChange={(e) => setNewBpBody(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <Textarea
                        placeholder="Mermaid (optional)"
                        value={newBpMermaid}
                        onChange={(e) => setNewBpMermaid(e.target.value)}
                        rows={2}
                        className="font-mono text-xs"
                      />
                      {newBpMermaid.trim() ? (
                        <div className="rounded-md border border-border bg-background p-2 overflow-x-auto">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">Mermaid preview</p>
                          <MermaidDiagram source={newBpMermaid} />
                        </div>
                      ) : null}
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => createBp.mutate()}
                        disabled={createBp.isPending}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add blueprint
                      </Button>
                    </div>
                  </div>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                    {selectedBlueprint ? (
                      <>
                        <Input
                          defaultValue={selectedBlueprint.title}
                          key={`bt-${selectedBlueprint.id}-${selectedBlueprint.updatedAt}`}
                          className="shrink-0 font-medium"
                          onBlur={(e) => {
                            const t = e.target.value.trim();
                            if (t && t !== selectedBlueprint.title) {
                              patchBlueprintMut.mutate({ id: selectedBlueprint.id, patch: { title: t } });
                            }
                          }}
                        />
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
                          <PlateFullKitMarkdownDocumentEditor
                            key={`sf-bp-${selectedBlueprint.id}-${editorBootNonce}`}
                            companyId={companyId ?? undefined}
                            documentId={`sf-bp-${selectedBlueprint.id}`}
                            initialMarkdown={selectedBlueprint.bodyMd ?? ""}
                            onMarkdownChange={(md) => scheduleBpBody(selectedBlueprint.id, md)}
                            editorPlaceholder="Architecture notes, ADR-style content…"
                            wikilinkMentionResolveDocumentId={resolveWikilinkMentionDocumentId}
                            fullBleed
                            className="min-h-0 flex-1 bg-transparent"
                          />
                        </div>
                        <div className="grid shrink-0 gap-3 lg:grid-cols-2 lg:gap-4">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Mermaid diagram source</p>
                            <Textarea
                              value={bpMermaidDraft}
                              className="font-mono text-xs min-h-[140px]"
                              placeholder="flowchart LR …"
                              spellCheck={false}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBpMermaidDraft(v);
                                const t = v.trim();
                                scheduleBpMermaid(selectedBlueprint.id, t.length ? t : null);
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Mermaid preview</p>
                            <div className="min-h-[140px] rounded-lg border border-border bg-card p-2 overflow-x-auto">
                              {bpMermaidDraft.trim() ? (
                                <MermaidDiagram source={bpMermaidDraft} />
                              ) : (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                  Add Mermaid above for a live diagram (same renderer as markdown notes).
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/10 p-3 shrink-0">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Linked requirements</p>
                          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                            {requirementsList.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Add requirements in Refinery first.</p>
                            ) : (
                              requirementsList.map((req) => {
                                const linked = selectedBlueprint.linkedRequirementIds ?? [];
                                const checked = linked.includes(req.id);
                                return (
                                  <label
                                    key={req.id}
                                    className="flex items-start gap-2 text-sm cursor-pointer rounded-md px-1 py-0.5 hover:bg-muted/50"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => {
                                        const on = v === true;
                                        const next = on
                                          ? Array.from(new Set([...linked, req.id]))
                                          : linked.filter((id) => id !== req.id);
                                        patchBlueprintMut.mutate({
                                          id: selectedBlueprint.id,
                                          patch: { linkedRequirementIds: next },
                                        });
                                      }}
                                      className="mt-0.5"
                                    />
                                    <span className="line-clamp-2 leading-snug">{req.title}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                        Select a blueprint to edit, or create one.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="planner" className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden">
                <div className="sticky top-0 z-1 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 py-2 pb-3 backdrop-blur-sm shrink-0 -mx-1 px-1">
                  <p className="text-[11px] text-muted-foreground leading-snug max-w-xl">
                    <span className="font-medium text-foreground/90">Planner</span> mirrors project{" "}
                    <span className="font-medium text-foreground/90">Issues</span> (list / board / table). Gantt uses{" "}
                    <span className="font-mono text-[10px]">planned_start_at</span> →{" "}
                    <span className="font-mono text-[10px]">planned_end_at</span> when both are set on a work order; otherwise{" "}
                    <span className="font-mono text-[10px]">created_at</span> →{" "}
                    <span className="font-mono text-[10px]">updated_at</span> (
                    {plannerGanttPort.timeBasis === "planned"
                      ? "all bars scheduled"
                      : plannerGanttPort.timeBasis === "mixed"
                        ? "mixed timeline"
                        : "created/updated only"}
                    ). Kanban drag updates status. View is remembered per project.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={designAssistMut.isPending || requirementsList.length === 0}
                      onClick={() => designAssistMut.mutate({ fromOpenRequirements: true })}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Draft WOs
                    </Button>
                  <div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
                    <button
                      type="button"
                      title="List view"
                      className={cn(
                        "p-2 transition-colors",
                        plannerViewMode === "list"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => updatePlannerViewMode("list")}
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Board (Kanban)"
                      className={cn(
                        "p-2 transition-colors border-l border-border",
                        plannerViewMode === "board"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => updatePlannerViewMode("board")}
                    >
                      <Columns3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Timeline (Gantt)"
                      className={cn(
                        "p-2 transition-colors border-l border-border",
                        plannerViewMode === "gantt"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => updatePlannerViewMode("gantt")}
                    >
                      <ChartGantt className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Table"
                      className={cn(
                        "p-2 transition-colors border-l border-border",
                        plannerViewMode === "table"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => updatePlannerViewMode("table")}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  </div>
                </div>

                {plannerViewMode === "list" ? (
                  <div className="flex min-h-[min(40vh,28rem)] flex-1 flex-col gap-4 lg:flex-row">
                    <div className="flex max-h-[min(100%,720px)] min-h-0 w-full shrink-0 flex-col rounded-lg border border-border bg-card/30 p-3 lg:w-72 lg:max-h-none">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work orders</p>
                      <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                        {workOrdersList.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
                            <p className="text-sm text-foreground">No work orders yet</p>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              Break the blueprint into executable slices. Use the form below.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3 gap-1.5"
                              onClick={() => document.getElementById("sf-new-wo-title")?.focus()}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              New work order
                            </Button>
                          </div>
                        ) : (
                          workOrdersList.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => selectWorkOrder(w.id)}
                              className={cn(
                                "w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                                selectedWorkOrderId === w.id
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/40",
                              )}
                            >
                              <span className="line-clamp-2 font-medium">{w.title}</span>
                              <span className="text-[10px] text-muted-foreground">{w.status}</span>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium text-muted-foreground">Add work order</p>
                        <Input
                          id="sf-new-wo-title"
                          placeholder="Title"
                          value={newWoTitle}
                          onChange={(e) => setNewWoTitle(e.target.value)}
                        />
                        <Textarea
                          placeholder="Description (markdown, optional)"
                          value={newWoDesc}
                          onChange={(e) => setNewWoDesc(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => createWo.mutate()}
                          disabled={createWo.isPending}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add work order
                        </Button>
                      </div>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                      {selectedWorkOrder ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                            <Input
                              defaultValue={selectedWorkOrder.title}
                              key={`wt-${selectedWorkOrder.id}-${selectedWorkOrder.updatedAt}`}
                              className="shrink-0 font-medium"
                              onBlur={(e) => {
                                const t = e.target.value.trim();
                                if (t && t !== selectedWorkOrder.title) {
                                  patchWorkOrderMut.mutate({
                                    id: selectedWorkOrder.id,
                                    patch: { title: t },
                                  });
                                }
                              }}
                            />
                            <SfWorkOrderMetaPanel
                              workOrder={selectedWorkOrder}
                              companyPrefix={companyPrefix}
                              patchWorkOrderMut={patchWorkOrderMut}
                              trackOnIssuesMut={trackOnIssuesMut}
                            />
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
                              <PlateFullKitMarkdownDocumentEditor
                                key={`sf-wo-${selectedWorkOrder.id}-${editorBootNonce}`}
                                companyId={companyId ?? undefined}
                                documentId={`sf-wo-${selectedWorkOrder.id}`}
                                initialMarkdown={selectedWorkOrder.descriptionMd ?? ""}
                                onMarkdownChange={(md) => scheduleWoDesc(selectedWorkOrder.id, md)}
                                editorPlaceholder="Scope, done-when, links…"
                                wikilinkMentionResolveDocumentId={resolveWikilinkMentionDocumentId}
                                fullBleed
                                className="min-h-0 flex-1 bg-transparent"
                              />
                            </div>
                          </div>
                          <Select
                            value={selectedWorkOrder.status}
                            onValueChange={(status) => patchWo.mutate({ id: selectedWorkOrder.id, status })}
                          >
                            <SelectTrigger className="w-full sm:w-[160px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WO_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replaceAll("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                          Select a work order to edit, or create one.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-4">
                    {plannerViewMode === "board" ? (
                      <PlannerKanbanFromPort
                        port={plannerKanbanPort}
                        handlers={plannerBoardHandlers}
                        onCardMoveToStatus={(id, status) => patchWo.mutate({ id, status })}
                      />
                    ) : null}
                    {plannerViewMode === "gantt" ? (
                      <PlannerGanttFromPort port={plannerGanttPort} handlers={plannerBoardHandlers} />
                    ) : null}
                    {plannerViewMode === "table" ? (
                      <PlannerTableFromPort rows={workOrdersList} handlers={plannerBoardHandlers} />
                    ) : null}

                    <div className="rounded-lg border border-border bg-card/30 p-3 space-y-2 shrink-0">
                      <p className="text-xs font-medium text-muted-foreground">Add work order</p>
                      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                        <Input
                          id="sf-new-wo-title-alt"
                          placeholder="Title"
                          value={newWoTitle}
                          onChange={(e) => setNewWoTitle(e.target.value)}
                          className="sm:flex-1"
                        />
                        <Button
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => createWo.mutate()}
                          disabled={createWo.isPending}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Description (markdown, optional)"
                        value={newWoDesc}
                        onChange={(e) => setNewWoDesc(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                      {selectedWorkOrder ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                            <Input
                              defaultValue={selectedWorkOrder.title}
                              key={`wt-alt-${selectedWorkOrder.id}-${selectedWorkOrder.updatedAt}`}
                              className="shrink-0 font-medium"
                              onBlur={(e) => {
                                const t = e.target.value.trim();
                                if (t && t !== selectedWorkOrder.title) {
                                  patchWorkOrderMut.mutate({
                                    id: selectedWorkOrder.id,
                                    patch: { title: t },
                                  });
                                }
                              }}
                            />
                            <SfWorkOrderMetaPanel
                              workOrder={selectedWorkOrder}
                              companyPrefix={companyPrefix}
                              patchWorkOrderMut={patchWorkOrderMut}
                              trackOnIssuesMut={trackOnIssuesMut}
                            />
                            <div className="flex min-h-48 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
                              <PlateFullKitMarkdownDocumentEditor
                                key={`sf-wo-alt-${selectedWorkOrder.id}-${editorBootNonce}`}
                                companyId={companyId ?? undefined}
                                documentId={`sf-wo-${selectedWorkOrder.id}`}
                                initialMarkdown={selectedWorkOrder.descriptionMd ?? ""}
                                onMarkdownChange={(md) => scheduleWoDesc(selectedWorkOrder.id, md)}
                                editorPlaceholder="Scope, done-when, links…"
                                wikilinkMentionResolveDocumentId={resolveWikilinkMentionDocumentId}
                                fullBleed
                                className="min-h-0 flex-1 bg-transparent"
                              />
                            </div>
                          </div>
                          <Select
                            value={selectedWorkOrder.status}
                            onValueChange={(status) => patchWo.mutate({ id: selectedWorkOrder.id, status })}
                          >
                            <SelectTrigger className="w-full sm:w-[160px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WO_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replaceAll("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                          Select a row or card to edit details here.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="validator" className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
                <div className="max-w-3xl rounded-lg border border-border bg-card/30 p-4 space-y-4">
                  <div>
                    <h2 className="text-sm font-medium">Record validation / feedback</h2>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Log CI, reviews, or incidents in one place. Structured JSON helps automation; summary is for humans
                      scanning history below.
                    </p>
                  </div>
                  <Input placeholder="Source (e.g. ci, review, manual)" value={valSource} onChange={(e) => setValSource(e.target.value)} />
                  <Textarea placeholder="Summary" value={valSummary} onChange={(e) => setValSummary(e.target.value)} rows={2} />
                  <Textarea
                    placeholder='JSON payload (e.g. {"failed": true, "job": "test"})'
                    value={valPayload}
                    onChange={(e) => setValPayload(e.target.value)}
                    rows={4}
                    className="font-mono text-xs"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={valSpawnWo} onChange={(e) => setValSpawnWo(e.target.checked)} />
                    Create work order from this event
                  </label>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => createVal.mutate()}
                    disabled={createVal.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Record event
                  </Button>
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent events</p>
                    {validationList.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No events recorded for this project yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {validationList.map((v) => (
                          <li key={v.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                            <div className="font-medium">{v.source}</div>
                            {v.summary ? <p className="mt-1">{v.summary}</p> : null}
                            {v.createdWorkOrderId ? (
                              <p className="text-xs text-muted-foreground mt-1">Work order: {v.createdWorkOrderId}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="gap-1"
                                disabled={designAssistMut.isPending}
                                onClick={() => designAssistMut.mutate({ validationEventId: v.id })}
                              >
                                <Sparkles className="h-3 w-3" />
                                Design assist
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>

            <FactoryAssistPanel tab={tab} projectName={project.name} projectUuid={projectUuid} />
          </div>
        </Tabs>
      </div>
    </DocumentLinkPickerProvider>
  );
}
