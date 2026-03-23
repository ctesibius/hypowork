import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Link, useBlocker, useLocation, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileText, Link2, MoreHorizontal, Trash2, FileBox, Layout, Eye } from "lucide-react";
import { ApiError, api } from "../api/client";
import { documentsApi } from "../api/documents";
import { issuesApi } from "../api/issues";
import { PlateFullKitMarkdownDocumentEditor } from "../components/PlateEditor/PlateFullKitMarkdownDocumentEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { DocumentLinkPickerProvider } from "../context/DocumentLinkPickerContext";
import { useToast } from "../context/ToastContext";
import { useAutosaveIndicator } from "../hooks/useAutosaveIndicator";
import { queryKeys } from "../lib/queryKeys";
import { readIssueDetailBreadcrumb } from "../lib/issueDetailBreadcrumb";
import {
  DocumentCanvasEditor,
  type DocumentCanvasEditorHandle,
} from "../components/canvas/DocumentCanvasEditor";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { getCanvasGraphJson, getProseBody } from "../lib/documentContent";

/** Debounced after title/body change; avoids hammering the server on every keystroke (Plate serializes on each change). */
const AUTOSAVE_MS = 2000;

const UUID_IN_AT_REF =
  /^@([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function wikilinkInnerFromRaw(raw: string): string | null {
  const m = raw.match(/^\[\[([^\]|#]+)/);
  const inner = m?.[1]?.trim() ?? "";
  return inner.length > 0 ? inner : null;
}

function outgoingLinkLabel(
  raw: string,
  targetDocumentId: string | null | undefined,
  titleById: Map<string, string>,
): string {
  if (targetDocumentId) {
    const t = titleById.get(targetDocumentId);
    if (t) return t;
  }
  const inner = wikilinkInnerFromRaw(raw);
  if (inner) return inner;
  const um = raw.match(UUID_IN_AT_REF);
  if (um?.[1]) {
    const id = um[1].toLowerCase();
    const t = titleById.get(id);
    if (t) return t;
  }
  return raw;
}

export function DocumentDetail() {
  const { documentId, companyPrefix } = useParams<{ documentId: string; companyPrefix: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs, setDocumentDetailChrome } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkIssueId, setLinkIssueId] = useState("");
  const [linkKey, setLinkKey] = useState("note");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Bump after conflict reload to remount the Plate editor from server markdown. */
  const [reloadNonce, setReloadNonce] = useState(0);
  const [canvasGraphDirty, setCanvasGraphDirty] = useState(false);
  const canvasEditorRef = useRef<DocumentCanvasEditorHandle | null>(null);
  const autosaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Server body at last sync — used to ignore spurious tiny serializes until Plate matches (not one-shot; multiple tiny events are common). */
  const baselineBodyRef = useRef("");
  /** False until Plate emits a non-spurious serialize vs baseline (large docs). Ref = source of truth in onMarkdownChange (avoids stale closure). */
  const plateHydratedRef = useRef(true);
  /** True while debounced autosave is scheduled (timer not yet fired). */
  const [pendingAutosave, setPendingAutosave] = useState(false);
  /** Shown while auto-saving on navigation, or when that save fails (Stay / Discard / Retry). */
  const [leavePrompt, setLeavePrompt] = useState<"off" | "working" | "failed">("off");
  const [leaveIgnoreCooldown, setLeaveIgnoreCooldown] = useState(0);
  const leaveGenRef = useRef(0);
  const leaveHandlingRef = useRef(false);
  const canvasGraphDirtyRef = useRef(false);
  const { state: autosaveState, markDirty, reset, runSave } = useAutosaveIndicator();
  /** Canvas presentation mode — read-only with minimal chrome */
  const [canvasViewMode, setCanvasViewMode] = useState(false);

  useEffect(() => {
    canvasGraphDirtyRef.current = canvasGraphDirty;
  }, [canvasGraphDirty]);

  const sourceBreadcrumb = useMemo(
    () => readIssueDetailBreadcrumb(location.state) ?? { label: "Documents", href: "/documents" },
    [location.state],
  );

  const { data: doc, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.companyDocuments.detail(selectedCompanyId!, documentId!),
    queryFn: () => documentsApi.get(selectedCompanyId!, documentId!),
    enabled: !!selectedCompanyId && !!documentId,
  });

  const docRef = useRef(doc);
  docRef.current = doc;

  /** API omits `kind` on some paths / legacy rows — treat as prose (matches CompanyDocument comment). */
  const effectiveDocKind = useMemo((): "prose" | "canvas" => {
    if (!doc) return "prose";
    return doc.kind === "canvas" ? "canvas" : "prose";
  }, [doc?.id, doc?.kind]);

  const { data: pickerDocuments } = useQuery({
    queryKey: queryKeys.companyDocuments.list(selectedCompanyId!),
    queryFn: () => documentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!doc,
  });

  const documentTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of pickerDocuments ?? []) {
      m.set(d.id, d.title?.trim() || "Untitled");
    }
    return m;
  }, [pickerDocuments]);

  const resolveWikilinkMentionDocumentId = useCallback(
    (wikilinkTitle: string) => {
      const q = wikilinkTitle.trim().toLowerCase();
      if (!q) return null;
      for (const d of pickerDocuments ?? []) {
        if (d.id === doc?.id) continue;
        const t = (d.title?.trim() || "Untitled").toLowerCase();
        if (t === q) return d.id;
      }
      return null;
    },
    [pickerDocuments, doc?.id],
  );

  const { data: linkData } = useQuery({
    queryKey: queryKeys.companyDocuments.links(selectedCompanyId!, documentId!),
    queryFn: () => documentsApi.links(selectedCompanyId!, documentId!),
    enabled: !!selectedCompanyId && !!documentId,
  });

  /** Keep hydration baseline aligned with server after saves/refetch (layout effect only runs on documentId / doc id). */
  useEffect(() => {
    if (!doc) return;
    baselineBodyRef.current = getProseBody(doc);
  }, [doc?.id, doc?.body, doc?.latestRevisionNumber, doc?.kind]);

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && linkOpen,
  });

  useEffect(() => {
    if (!doc) return;
    setBreadcrumbs([
      { label: sourceBreadcrumb.label, href: sourceBreadcrumb.href },
      { label: title.trim() || "Untitled", kind: "document-title" },
    ]);
  }, [setBreadcrumbs, sourceBreadcrumb.label, sourceBreadcrumb.href, doc?.id, title]);

  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  useEffect(() => {
    titleRef.current = title;
    bodyRef.current = body;
  }, [title, body]);

  const copyDocument = useCallback(async () => {
    const t = titleRef.current.trim() || "Untitled";
    const d = docRef.current;
    let md: string;
    if (d?.kind === "canvas") {
      const json = canvasEditorRef.current?.getSerializedBody() ?? getCanvasGraphJson(d);
      const prose = getProseBody(d);
      md = `# ${t}\n\n## Prose\n\n${prose}\n\n## Canvas graph\n\n\`\`\`json\n${json}\n\`\`\``;
    } else {
      md = `# ${t}\n\n${bodyRef.current}`.trimEnd();
    }
    await navigator.clipboard.writeText(md);
    setCopied(true);
    pushToast({ title: "Copied to clipboard", tone: "success" });
    setTimeout(() => setCopied(false), 2000);
  }, [pushToast]);

  useEffect(() => {
    return () => setDocumentDetailChrome(null);
  }, [setDocumentDetailChrome]);

  useLayoutEffect(() => {
    if (!doc) return;
    baselineBodyRef.current = getProseBody(doc);
    const baselineLen = baselineBodyRef.current.length;
    const ph = baselineLen <= 500;
    plateHydratedRef.current = ph;
    setReloadNonce(0);
    setCanvasGraphDirty(false);
    setTitle(doc.title ?? "");
    setBody(getProseBody(doc));
    reset();
  }, [documentId, doc?.id, doc?.kind, reset]);

  useEffect(() => {
    setCanvasGraphDirty(false);
  }, [documentId]);

  const updateMut = useMutation({
    mutationFn: async () => {
      const d = docRef.current;
      if (!selectedCompanyId || !d) throw new Error("Missing document");
      if (!d.latestRevisionId) throw new Error("Document has no revision yet");
      return documentsApi.update(selectedCompanyId, d.id, {
        title: title.trim() || null,
        format: "markdown",
        body,
        baseRevisionId: d.latestRevisionId,
      });
    },
    onSuccess: (next) => {
      setConflictMessage(null);
      queryClient.setQueryData(
        queryKeys.companyDocuments.detail(selectedCompanyId!, next.id),
        next,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.companyDocuments.links(selectedCompanyId!, next.id),
      });
      reset();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictMessage("This document was changed elsewhere. Reload to get the latest version, then save again.");
      }
    },
  });

  const updateMutRef = useRef(updateMut);
  updateMutRef.current = updateMut;

  const commitSave = useCallback(async () => {
    if (!doc) return;
    if (effectiveDocKind === "canvas") {
      await runSave(async () => {
        await canvasEditorRef.current?.flushSave();
      });
      return;
    }
    const sameTitle = (doc.title ?? "") === title.trim();
    const sameBody = getProseBody(doc) === body;
    if (sameTitle && sameBody) return;
    await runSave(async () => {
      await updateMut.mutateAsync();
    });
  }, [doc, effectiveDocKind, title, body, runSave, updateMut]);

  const commitSaveRef = useRef(commitSave);
  commitSaveRef.current = commitSave;

  const deleteMut = useMutation({
    mutationFn: () => documentsApi.remove(selectedCompanyId!, documentId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      navigate("/documents");
    },
  });

  const deleteMutRef = useRef(deleteMut);
  deleteMutRef.current = deleteMut;

  const { mutate: switchDocumentMode, isPending: modeSwitchPending } = useMutation({
    mutationFn: async (targetMode: "prose" | "canvas") => {
      const d = docRef.current;
      const cid = selectedCompanyId;
      if (!d || !cid) throw new Error("Missing data");
      /** Nest: `app.setGlobalPrefix("api")` + DocumentModeController `@Post("companies/.../switch")` → `/api/companies/.../switch` */
      const path = `/companies/${cid}/documents/${d.id}/switch`;
      const json = await api.post<{
        documentId: string;
        mode: string;
        migrated: boolean;
        migrationWarnings?: string[];
      }>(path, { targetMode });
      return { json, targetMode };
    },
    onSuccess: ({ json, targetMode }) => {
      if (json.migrationWarnings?.length) {
        pushToast({
          title: `Switched to ${targetMode}`,
          body: json.migrationWarnings.join(" "),
          tone: "info",
        });
      } else {
        pushToast({ title: `Switched to ${targetMode}`, tone: "success" });
      }
      void refetch();
    },
    onError: (err) => {
      pushToast({
        title: "Could not switch view",
        body: err instanceof ApiError ? err.message : String(err),
        tone: "error",
      });
    },
  });

  const documentToolbarActions = useMemo(
    () => (
      <>
        {/* Mode Toggle — direct switch (Hypopedia-style), no confirmation dialog */}
        {effectiveDocKind === "prose" && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() =>
              void (async () => {
                await commitSaveRef.current();
                switchDocumentMode("canvas");
              })()
            }
            disabled={modeSwitchPending}
            title="Switch to Canvas"
          >
            <FileBox className="h-4 w-4" />
          </Button>
        )}
        {effectiveDocKind === "canvas" && (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCanvasViewMode((v) => !v)}
              title={canvasViewMode ? "Exit presentation mode" : "Enter presentation mode"}
              className={canvasViewMode ? "text-primary" : ""}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() =>
                void (async () => {
                  await commitSaveRef.current();
                  switchDocumentMode("prose");
                })()
              }
              disabled={modeSwitchPending}
              title="Switch to Prose"
            >
              <Layout className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-xs" onClick={() => void copyDocument()} title="Copy as markdown">
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setLinkOpen(true)} title="Link to issue">
          <Link2 className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="shrink-0" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-accent/50"
              onClick={() => {
                if (confirm("Delete this document?")) void deleteMutRef.current.mutateAsync();
              }}
            >
              <Trash2 className="h-3 w-3" />
              Delete document
            </button>
          </PopoverContent>
        </Popover>
      </>
    ),
    [copied, copyDocument, canvasViewMode, effectiveDocKind, switchDocumentMode, modeSwitchPending],
  );

  const linkMut = useMutation({
    mutationFn: async () => {
      const issueId = linkIssueId.trim();
      const key = linkKey.trim().toLowerCase();
      await documentsApi.linkIssue(selectedCompanyId!, documentId!, { issueId, key });
      return { issueId };
    },
    onSuccess: async (data) => {
      const issueId = data.issueId;
      const prefix = companyPrefix ?? "";
      const title = (doc?.title ?? "Untitled").trim();
      const path = prefix ? `/${prefix}/documents/${documentId}` : `/documents/${documentId}`;
      try {
        await issuesApi.addComment(issueId, `Linked company document **${title}** — ${path}`);
      } catch {
        /* non-fatal: link succeeded even if comment fails */
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues.activity(issueId) });
      setLinkOpen(false);
      setLinkIssueId("");
      setLinkKey("note");
    },
  });

  useEffect(() => {
    if (!doc || doc.id !== documentId) {
      setDocumentDetailChrome(null);
      return;
    }
    const isCanvasDoc = effectiveDocKind === "canvas";
    const autosaveLabel = isCanvasDoc
      ? canvasGraphDirty
        ? "Unsaved changes"
        : "Saved"
      : autosaveState === "saving"
        ? "Saving…"
        : autosaveState === "saved"
          ? "Saved"
          : autosaveState === "error"
            ? "Save failed"
            : "";
    setDocumentDetailChrome({
      revisionNumber: doc.latestRevisionNumber,
      title,
      onTitleChange: setTitle,
      autosaveLabel,
      toolbarActions: documentToolbarActions,
    });
  }, [
    doc?.id,
    doc?.latestRevisionNumber,
    documentId,
    title,
    setDocumentDetailChrome,
    autosaveState,
    canvasGraphDirty,
    documentToolbarActions,
    effectiveDocKind,
  ]);

  useEffect(() => {
    if (!doc || effectiveDocKind === "canvas") return;
    const serverProse = getProseBody(doc);
    const changed = (doc.title ?? "") !== title.trim() || serverProse !== body;
    if (!changed) {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
        autosaveDebounceRef.current = null;
      }
      setPendingAutosave(false);
      return;
    }
    markDirty();
    if (autosaveDebounceRef.current) clearTimeout(autosaveDebounceRef.current);
    setPendingAutosave(true);
    autosaveDebounceRef.current = setTimeout(() => {
      setPendingAutosave(false);
      void commitSave();
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, [title, body, doc, effectiveDocKind, commitSave, markDirty]);

  const flushPendingAutosaveTimer = useCallback(() => {
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
      autosaveDebounceRef.current = null;
    }
    setPendingAutosave(false);
  }, []);

  const isDirtyVsServer =
    !!doc &&
    (effectiveDocKind === "canvas"
      ? (doc.title ?? "") !== title.trim() || canvasGraphDirty
      : (doc.title ?? "") !== title.trim() || getProseBody(doc) !== body);

  const shouldBlockNavigation =
    !!doc &&
    (autosaveState === "saving" ||
      pendingAutosave ||
      isDirtyVsServer);

  const blocker = useBlocker(shouldBlockNavigation);

  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  useEffect(() => {
    if (leavePrompt !== "failed") return;
    setLeaveIgnoreCooldown(5);
    const id = window.setInterval(() => {
      setLeaveIgnoreCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [leavePrompt]);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      leaveHandlingRef.current = false;
      setLeavePrompt("off");
      return;
    }

    const gen = ++leaveGenRef.current;
    leaveHandlingRef.current = true;
    let cancelled = false;

    const isDirtyNow = () => {
      const d = docRef.current;
      if (!d) return false;
      if (d.kind === "canvas") {
        return (d.title ?? "") !== titleRef.current.trim() || canvasGraphDirtyRef.current;
      }
      return (
        (d.title ?? "") !== titleRef.current.trim() ||
        getProseBody(d) !== bodyRef.current
      );
    };

    const waitForPendingSave = async () => {
      const deadline = Date.now() + 60_000;
      while (updateMutRef.current.isPending && Date.now() < deadline) {
        await new Promise<void>((r) => {
          window.setTimeout(r, 50);
        });
      }
    };

    void (async () => {
      setLeavePrompt("working");
      flushPendingAutosaveTimer();
      await waitForPendingSave();
      if (cancelled || gen !== leaveGenRef.current) return;

      if (!isDirtyNow()) {
        const b = blockerRef.current;
        if (b.state === "blocked") b.proceed();
        leaveHandlingRef.current = false;
        setLeavePrompt("off");
        return;
      }

      try {
        await commitSaveRef.current();
      } catch {
        if (cancelled || gen !== leaveGenRef.current) return;
        setLeavePrompt("failed");
        leaveHandlingRef.current = false;
        return;
      }
      if (cancelled || gen !== leaveGenRef.current) return;
      const b = blockerRef.current;
      if (b.state === "blocked") b.proceed();
      leaveHandlingRef.current = false;
      setLeavePrompt("off");
    })();

    return () => {
      cancelled = true;
      leaveGenRef.current += 1;
      leaveHandlingRef.current = false;
    };
  }, [blocker.state, flushPendingAutosaveTimer]);

  useEffect(() => {
    if (!shouldBlockNavigation) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shouldBlockNavigation]);

  const handleLeaveRetry = async () => {
    flushPendingAutosaveTimer();
    setLeavePrompt("working");
    try {
      await commitSave();
      const b = blockerRef.current;
      if (b.state === "blocked") b.proceed();
      setLeavePrompt("off");
    } catch {
      setLeavePrompt("failed");
    }
  };

  const handleLeaveDiscard = () => {
    if (leaveIgnoreCooldown > 0) return;
    if (blockerRef.current.state === "blocked") blockerRef.current.proceed();
    setLeavePrompt("off");
  };

  const handleReloadAfterConflict = async () => {
    setConflictMessage(null);
    const r = await refetch();
    const d = r.data;
    if (d) {
      baselineBodyRef.current = getProseBody(d);
      const ph = (getProseBody(d).length ?? 0) <= 500;
      plateHydratedRef.current = ph;
      setTitle(d.title ?? "");
      setBody(getProseBody(d));
      setReloadNonce((n) => n + 1);
    }
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

  const documentLinkPickerValue =
    pickerDocuments && doc
      ? {
          documents: pickerDocuments.map((d) => ({ id: d.id, title: d.title })),
          currentDocumentId: doc.id,
        }
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conflictMessage && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm md:px-6">
          <span>{conflictMessage}</span>
          <Button size="sm" variant="outline" onClick={handleReloadAfterConflict}>
            Reload
          </Button>
        </div>
      )}

      <DocumentLinkPickerProvider value={documentLinkPickerValue}>
        {effectiveDocKind === "canvas" ? (
          <ReactFlowProvider key={`${doc.id}-${reloadNonce}`}>
            <DocumentCanvasEditor
              ref={canvasEditorRef}
              companyId={selectedCompanyId!}
              documentId={doc.id}
              title={title}
              canvasGraphFromServer={getCanvasGraphJson(doc)}
              proseBodyFromServer={getProseBody(doc)}
              docTitleFromServer={doc.title}
              latestRevisionId={doc.latestRevisionId}
              wikilinkMentionResolveDocumentId={resolveWikilinkMentionDocumentId}
              onApplied={(next) => {
                setConflictMessage(null);
                queryClient.setQueryData(
                  queryKeys.companyDocuments.detail(selectedCompanyId!, next.id),
                  next,
                );
                void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
                void queryClient.invalidateQueries({
                  queryKey: queryKeys.companyDocuments.links(selectedCompanyId!, next.id),
                });
                reset();
              }}
              onConflict={() => {
                setConflictMessage(
                  "This document was changed elsewhere. Reload to get the latest version, then save again.",
                );
              }}
              onGraphDirtyChange={setCanvasGraphDirty}
              viewMode={canvasViewMode}
              onNodeSelect={(nodeId, ctx) => {
                if (!nodeId || !ctx) return;
                const parts: string[] = [];
                const sel = ctx.selectedNode;
                parts.push(`Selected: [${sel.type}] ${JSON.stringify(sel.data ?? {})}`);
                for (const n of ctx.neighborNodes) {
                  parts.push(`Connected: [${n.type}] ${JSON.stringify(n.data ?? {})}`);
                }
                const nodeContext = parts.join("\n");
                navigate(`../chat?context=${encodeURIComponent(nodeContext)}&doc=${doc.id}`);
              }}
            />
          </ReactFlowProvider>
        ) : (
          <PlateFullKitMarkdownDocumentEditor
            key={`${doc.id}-${reloadNonce}-${pickerDocuments === undefined ? "p" : "r"}`}
            companyId={selectedCompanyId ?? undefined}
            documentId={doc.id}
            reloadNonce={reloadNonce}
            initialMarkdown={getProseBody(doc)}
            wikilinkMentionResolveDocumentId={resolveWikilinkMentionDocumentId}
            onMarkdownChange={(md) => {
              const baseline = baselineBodyRef.current;
              const bl = baseline.length;
              const tinyVsBaseline = bl > 500 && md.length > 0 && md.length < bl * 0.05;

              if (!plateHydratedRef.current && tinyVsBaseline) {
                return;
              }

              if (!plateHydratedRef.current) {
                plateHydratedRef.current = true;
              }
              setBody(md);
            }}
            fullBleed
            className="min-h-0 flex-1 bg-transparent"
            editorPlaceholder="Write… Markdown is saved as the document body. Type @ or [[ to link another company note."
          />
        )}
      </DocumentLinkPickerProvider>

      {linkData && (linkData.out.length > 0 || linkData.in.length > 0) && (
        <div className="shrink-0 border-t border-border px-4 py-3 text-sm md:px-6">
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 font-medium text-muted-foreground">Links from this note</p>
              <ul className="space-y-1">
                {linkData.out.map((row, i) => (
                  <li key={`${row.rawReference}-${i}`} className="truncate">
                    {row.targetDocumentId ? (
                      <Link
                        className="text-primary underline-offset-2 hover:underline"
                        to={`/documents/${row.targetDocumentId}`}
                      >
                        {outgoingLinkLabel(row.rawReference, row.targetDocumentId, documentTitleById)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground" title="No matching company note">
                        {outgoingLinkLabel(row.rawReference, row.targetDocumentId, documentTitleById)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-muted-foreground">Notes linking here</p>
              <ul className="space-y-1">
                {linkData.in.map((row, i) => (
                  <li key={`${row.sourceDocumentId}-${row.rawReference}-${i}`} className="truncate">
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      to={`/documents/${row.sourceDocumentId}`}
                    >
                      {documentTitleById.get(row.sourceDocumentId) ?? "Untitled note"}
                    </Link>
                    <span className="text-muted-foreground"> · from note</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <Dialog open={leavePrompt === "working"}>
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Saving changes…</DialogTitle>
            <DialogDescription className="text-pretty">
              Finishing save so you can leave this document.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog
        open={leavePrompt === "failed"}
        onOpenChange={(open) => {
          if (!open) {
            blocker.reset?.();
            setLeavePrompt("off");
            leaveHandlingRef.current = false;
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Couldn&apos;t save</DialogTitle>
            <DialogDescription className="text-pretty">
              {conflictMessage ??
                (updateMut.error instanceof ApiError
                  ? updateMut.error.message
                  : updateMut.error instanceof Error
                    ? updateMut.error.message
                    : "Your changes could not be saved. Stay to keep editing, try again, or discard and leave.")}
            </DialogDescription>
            {leaveIgnoreCooldown > 0 && (
              <p className="text-muted-foreground text-sm pt-1" aria-live="polite">
                Discard unlocks in {leaveIgnoreCooldown}s…
              </p>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                blocker.reset?.();
                setLeavePrompt("off");
                leaveHandlingRef.current = false;
              }}
            >
              Stay
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={leaveIgnoreCooldown > 0}
              onClick={handleLeaveDiscard}
            >
              Discard {leaveIgnoreCooldown > 0 ? `(${leaveIgnoreCooldown})` : ""}
            </Button>
            <Button type="button" onClick={() => void handleLeaveRetry()}>
              Retry save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
