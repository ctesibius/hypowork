import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Copy,
  FileText,
  Link2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { agentsApi } from "../api/agents";
import { ApiError } from "../api/client";
import { documentsApi } from "../api/documents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { MarkdownEditor, type MentionOption } from "../components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { useProjectOrder } from "../hooks/useProjectOrder";
import { useAutosaveIndicator } from "../hooks/useAutosaveIndicator";
import { queryKeys } from "../lib/queryKeys";
import { authApi } from "../api/auth";
import { readIssueDetailBreadcrumb } from "../lib/issueDetailBreadcrumb";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";

const AUTOSAVE_MS = 900;

export function DocumentDetail() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkIssueId, setLinkIssueId] = useState("");
  const [linkKey, setLinkKey] = useState("note");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const autosaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { state: autosaveState, markDirty, reset, runSave } = useAutosaveIndicator();

  const sourceBreadcrumb = useMemo(
    () => readIssueDetailBreadcrumb(location.state) ?? { label: "Documents", href: "/documents" },
    [location.state],
  );

  const { data: doc, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.companyDocuments.detail(selectedCompanyId!, documentId!),
    queryFn: () => documentsApi.get(selectedCompanyId!, documentId!),
    enabled: !!selectedCompanyId && !!documentId,
  });

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { orderedProjects } = useProjectOrder({
    projects: projects ?? [],
    companyId: selectedCompanyId,
    userId: currentUserId,
  });

  const mentionOptions = useMemo<MentionOption[]>(() => {
    const options: MentionOption[] = [];
    const activeAgents = [...(agents ?? [])]
      .filter((agent) => agent.status !== "terminated")
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const agent of activeAgents) {
      options.push({
        id: `agent:${agent.id}`,
        name: agent.name,
        kind: "agent",
      });
    }
    for (const project of orderedProjects) {
      options.push({
        id: `project:${project.id}`,
        name: project.name,
        kind: "project",
        projectId: project.id,
        projectColor: project.color,
      });
    }
    return options;
  }, [agents, orderedProjects]);

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && linkOpen,
  });

  useEffect(() => {
    const titleLabel = doc?.title?.trim() || "Document";
    setBreadcrumbs([
      { label: sourceBreadcrumb.label, href: sourceBreadcrumb.href },
      { label: titleLabel },
    ]);
  }, [setBreadcrumbs, sourceBreadcrumb.label, sourceBreadcrumb.href, doc?.title]);

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title ?? "");
    setBody(doc.body);
    reset();
  }, [documentId, doc?.id, doc?.latestRevisionId, reset]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId || !doc) throw new Error("Missing document");
      if (!doc.latestRevisionId) throw new Error("Document has no revision yet");
      return documentsApi.update(selectedCompanyId, doc.id, {
        title: title.trim() || null,
        format: "markdown",
        body,
        baseRevisionId: doc.latestRevisionId,
      });
    },
    onSuccess: (next) => {
      setConflictMessage(null);
      queryClient.setQueryData(
        queryKeys.companyDocuments.detail(selectedCompanyId!, next.id),
        next,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      reset();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictMessage("This document was changed elsewhere. Reload to get the latest version, then save again.");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => documentsApi.remove(selectedCompanyId!, documentId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      navigate("/documents");
    },
  });

  const linkMut = useMutation({
    mutationFn: () =>
      documentsApi.linkIssue(selectedCompanyId!, documentId!, {
        issueId: linkIssueId.trim(),
        key: linkKey.trim().toLowerCase(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      setLinkOpen(false);
      setLinkIssueId("");
      setLinkKey("note");
    },
  });

  const commitSave = useCallback(async () => {
    if (!doc) return;
    const sameTitle = (doc.title ?? "") === title;
    const sameBody = doc.body === body;
    if (sameTitle && sameBody) return;
    await runSave(async () => {
      await updateMut.mutateAsync();
    });
  }, [doc, title, body, runSave, updateMut]);

  useEffect(() => {
    if (!doc) return;
    const changed = (doc.title ?? "") !== title || doc.body !== body;
    if (!changed) return;
    markDirty();
    if (autosaveDebounceRef.current) clearTimeout(autosaveDebounceRef.current);
    autosaveDebounceRef.current = setTimeout(() => {
      void commitSave();
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveDebounceRef.current) clearTimeout(autosaveDebounceRef.current);
    };
  }, [title, body, doc, commitSave, markDirty]);

  const copyDocument = async () => {
    const t = title.trim() || "Untitled";
    const md = `# ${t}\n\n${body}`.trimEnd();
    await navigator.clipboard.writeText(md);
    setCopied(true);
    pushToast({ title: "Copied to clipboard", tone: "success" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReloadAfterConflict = () => {
    setConflictMessage(null);
    void refetch();
  };

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view documents." />;
  }

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load document"}
      </p>
    );
  }
  if (!doc) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link
          to={sourceBreadcrumb.href}
          state={location.state}
          className="hover:text-foreground transition-colors"
        >
          {sourceBreadcrumb.label}
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="max-w-[min(100%,280px)] truncate text-foreground/60">
          {doc.title?.trim() || "Untitled"}
        </span>
      </nav>

      {conflictMessage && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          <span>{conflictMessage}</span>
          <Button size="sm" variant="outline" onClick={handleReloadAfterConflict}>
            Reload
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-mono text-sm text-muted-foreground">{doc.id.slice(0, 8)}</span>
          <span className="text-xs text-muted-foreground">· rev {doc.latestRevisionNumber}</span>
          <span className="text-xs text-muted-foreground">
            {autosaveState === "saving" && "Saving…"}
            {autosaveState === "saved" && "Saved"}
            {autosaveState === "error" && "Save failed"}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" onClick={() => void copyDocument()} title="Copy as markdown">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setLinkOpen(true)} title="Link to issue">
              <Link2 className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-xs" className="shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-accent/50"
                  onClick={() => {
                    if (confirm("Delete this document?")) void deleteMut.mutateAsync();
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete document
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <label htmlFor="doc-title" className="sr-only">
            Title
          </label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="h-auto border-0 px-0 py-0 text-xl font-bold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Markdown</h3>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            placeholder="Write markdown…"
            bordered={false}
            className="bg-transparent"
            contentClassName="min-h-[280px] text-[15px] leading-7 text-foreground"
            mentions={mentionOptions}
            onSubmit={() => void commitSave()}
          />
          <p className="text-xs text-muted-foreground">
            Markdown is the source of truth. Autosaves after you pause typing.{" "}
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⌘</kbd>+
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">Enter</kbd> to save.
          </p>
        </div>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to issue</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Attaches this note to an issue with a document key (e.g. <code className="text-xs">plan</code>,{" "}
            <code className="text-xs">note</code>).
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="link-issue">Issue</Label>
              <select
                id="link-issue"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={linkIssueId}
                onChange={(e) => setLinkIssueId(e.target.value)}
              >
                <option value="">Select issue…</option>
                {(issues ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.identifier} — {i.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="link-key">Document key</Label>
              <Input id="link-key" value={linkKey} onChange={(e) => setLinkKey(e.target.value)} placeholder="note" />
            </div>
            {linkMut.isError && (
              <p className="text-sm text-destructive">
                {linkMut.error instanceof ApiError ? linkMut.error.message : String(linkMut.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void linkMut.mutate()}
              disabled={linkMut.isPending || !linkIssueId.trim() || !linkKey.trim()}
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
