import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MessageCircle, Plus, Send, X } from "lucide-react";
import { chatApi, type ChatMessage, type ThreadContextRef } from "../../api/chat";
import { documentsApi } from "../../api/documents";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "../../lib/utils";
import { ChatMessageBubble, ReasoningBubble } from "./ChatMessageBubble";

export type CompanyChatWorkspaceProps = {
  companyId: string;
  companyPrefix: string | null;
  layout: "sheet" | "page";
  /** Current note id from route — enables This note / Global toggle */
  routeDocumentId?: string | null;
  projectIdFilter?: string | null;
  /** Floating sheet: fetch only while open */
  sheetOpen?: boolean;
  showFullPageLink?: boolean;
  /** Extra query string for full-page link e.g. document=&project= */
  fullPageSearch?: string;
  showAgentsFooter?: boolean;
  onClose?: () => void;
  /** Canvas "Ask about this" — prepended to first outgoing message */
  pendingNodeContext?: string | null;
  onClearPendingNodeContext?: () => void;
};

export function CompanyChatWorkspace({
  companyId,
  companyPrefix,
  layout,
  routeDocumentId,
  projectIdFilter,
  sheetOpen = true,
  showFullPageLink,
  fullPageSearch,
  showAgentsFooter,
  onClose,
  pendingNodeContext,
  onClearPendingNodeContext,
}: CompanyChatWorkspaceProps) {
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [showReasoning, setShowReasoning] = useState(false);
  const [documentScopeEnabled, setDocumentScopeEnabled] = useState(() => Boolean(routeDocumentId));
  const [attachedRefs, setAttachedRefs] = useState<ThreadContextRef[]>([]);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const enabled = layout === "page" || sheetOpen;

  const listFilters = useMemo(() => {
    const f: { projectId?: string; documentId?: string } = {};
    if (projectIdFilter) f.projectId = projectIdFilter;
    if (routeDocumentId && documentScopeEnabled) f.documentId = routeDocumentId;
    return f;
  }, [projectIdFilter, routeDocumentId, documentScopeEnabled]);

  const primaryDocumentId =
    documentScopeEnabled && routeDocumentId ? routeDocumentId : undefined;

  /** When navigating to a different note (or onto a note route), default to This note. */
  useEffect(() => {
    if (routeDocumentId) setDocumentScopeEnabled(true);
  }, [routeDocumentId]);

  const { data: threads = [] } = useQuery({
    queryKey: queryKeys.chat.threads(companyId, listFilters),
    queryFn: () => chatApi.listThreads(companyId, listFilters),
    enabled: !!companyId && enabled,
  });

  const { data: threadData } = useQuery({
    queryKey: queryKeys.chat.thread(companyId, threadId!),
    queryFn: () => chatApi.getThread(companyId, threadId!),
    enabled: !!companyId && !!threadId && enabled,
  });

  const { data: documents = [] } = useQuery({
    queryKey: queryKeys.companyDocuments.list(
      companyId,
      projectIdFilter ? { projectId: projectIdFilter } : undefined,
    ),
    queryFn: () => documentsApi.list(companyId, projectIdFilter ? { projectId: projectIdFilter } : undefined),
    enabled: !!companyId && enabled,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId && enabled && !!showAgentsFooter && layout === "page",
  });

  const docTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of documents) {
      m.set(d.id, d.title?.trim() || "(untitled)");
    }
    return m;
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documents.slice(0, 80);
    return documents
      .filter((d) => (d.title ?? "").toLowerCase().includes(q) || d.id.toLowerCase().includes(q))
      .slice(0, 80);
  }, [documents, docSearch]);

  useEffect(() => {
    if (!threadId || !threadData) return;
    const fromServer = threadData.contextRefs?.length ? threadData.contextRefs : [];
    if (fromServer.length > 0) {
      setAttachedRefs(fromServer);
    } else if (threadData.documentId) {
      setAttachedRefs([{ type: "document", id: threadData.documentId }]);
    } else {
      setAttachedRefs([]);
    }
  }, [threadId, threadData?.id, threadData?.updatedAt, threadData?.contextRefs, threadData?.documentId]);

  useEffect(() => {
    if (threadId) return;
    if (primaryDocumentId) {
      setAttachedRefs((prev) => {
        const has = prev.some((r) => r.id === primaryDocumentId);
        if (has) return prev;
        return [{ type: "document", id: primaryDocumentId }, ...prev];
      });
    } else {
      setAttachedRefs((prev) =>
        routeDocumentId ? prev.filter((r) => r.id !== routeDocumentId) : prev,
      );
    }
  }, [threadId, primaryDocumentId, routeDocumentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadData?.messages, optimisticMessages, showReasoning, enabled]);

  useEffect(() => {
    if (!enabled) {
      setOptimisticMessages([]);
      setShowReasoning(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !routeDocumentId || !documentScopeEnabled) return;
    if (threads.length === 0) {
      setThreadId(null);
      return;
    }
    setThreadId((current) => {
      if (current && threads.some((t) => t.id === current)) return current;
      return threads[0]!.id;
    });
  }, [enabled, routeDocumentId, documentScopeEnabled, threads]);

  const persistThreadRefs = useCallback(
    async (next: ThreadContextRef[]) => {
      if (!threadId) return;
      const docId = primaryDocumentId ?? null;
      await chatApi.patchThread(companyId, threadId, {
        contextRefs: next,
        documentId: docId,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(companyId, threadId) });
      void queryClient.invalidateQueries({ queryKey: ["chat", companyId, "threads"] });
    },
    [companyId, threadId, primaryDocumentId, queryClient],
  );

  const addDocumentRef = async (docId: string) => {
    if (attachedRefs.some((r) => r.id === docId)) {
      setDocPickerOpen(false);
      setDocSearch("");
      return;
    }
    const next = [...attachedRefs, { type: "document" as const, id: docId }];
    setAttachedRefs(next);
    setDocPickerOpen(false);
    setDocSearch("");
    if (threadId) await persistThreadRefs(next);
  };

  const removeDocumentRef = async (docId: string) => {
    if (primaryDocumentId && docId === primaryDocumentId) return;
    const next = attachedRefs.filter((r) => r.id !== docId);
    setAttachedRefs(next);
    if (threadId) await persistThreadRefs(next);
  };

  const createThreadMut = useMutation({
    mutationFn: (title: string) =>
      chatApi.createThread(companyId, {
        title,
        type: primaryDocumentId ? "document" : "general",
        scope: primaryDocumentId ? "document" : undefined,
        documentId: primaryDocumentId,
        contextRefs: attachedRefs.length ? attachedRefs : undefined,
        ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
      }),
    onSuccess: (t) => {
      setThreadId(t.id);
      void queryClient.invalidateQueries({ queryKey: ["chat", companyId, "threads"] });
    },
  });

  const sendMessageMut = useMutation({
    mutationFn: async (params: { content: string; threadId: string }) =>
      chatApi.sendMessage(companyId, params.threadId, { content: params.content }),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(companyId, vars.threadId) });
    },
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !companyId || busy) return;
    setBusy(true);
    setInput("");
    try {
      let tid = threadId;
      if (!tid) {
        const t = await chatApi.createThread(companyId, {
          title: text.slice(0, 48),
          type: primaryDocumentId ? "document" : "general",
          scope: primaryDocumentId ? "document" : undefined,
          documentId: primaryDocumentId,
          contextRefs: attachedRefs.length ? attachedRefs : undefined,
          ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
        });
        tid = t.id;
        setThreadId(tid);
        void queryClient.invalidateQueries({ queryKey: ["chat", companyId, "threads"] });
      }

      const content =
        pendingNodeContext && onClearPendingNodeContext
          ? `About this canvas element:\n${pendingNodeContext}\n\n${text}`
          : text;
      if (pendingNodeContext && onClearPendingNodeContext) onClearPendingNodeContext();

      const optimisticUserMessage: ChatMessage = {
        id: `optimistic-${layout}-${Date.now()}`,
        threadId: tid,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticUserMessage]);
      setShowReasoning(true);

      await sendMessageMut.mutateAsync({ content, threadId: tid });
      setOptimisticMessages([]);
      setShowReasoning(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRate = async (messageId: string, thumbsUp: boolean, promptVersionId?: string) => {
    try {
      await chatApi.rateMessage(companyId, messageId, { thumbsUp, promptVersionId });
      if (threadId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(companyId, threadId) });
      }
    } catch (err) {
      console.error("Failed to rate message:", err);
    }
  };

  /** De-dupe: GET /thread can return the persisted user row while POST /messages is still in flight (user is saved before LLM). */
  const mergedMessages = useMemo(() => {
    const server = threadData?.messages ?? [];
    const extra = optimisticMessages.filter((om) => {
      if (om.role !== "user") return true;
      return !server.some((sm) => sm.role === "user" && sm.content === om.content);
    });
    return [...server, ...extra];
  }, [threadData?.messages, optimisticMessages]);

  const fullChatHref = useMemo(() => {
    const path =
      companyPrefix != null && companyPrefix.length > 0 ? `/${companyPrefix}/chat` : "/chat";
    const qs = fullPageSearch?.trim() || "";
    return qs ? `${path}?${qs.replace(/^\?/, "")}` : path;
  }, [companyPrefix, fullPageSearch]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
    if (e.key === "@") {
      e.preventDefault();
      setDocPickerOpen(true);
    }
  };

  const scopeToggle =
    routeDocumentId != null && routeDocumentId.length > 0 ? (
      <div className="flex gap-1 rounded-md border border-border bg-muted/40 p-0.5">
        <Button
          type="button"
          variant={documentScopeEnabled ? "secondary" : "ghost"}
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => setDocumentScopeEnabled(true)}
        >
          This note
        </Button>
        <Button
          type="button"
          variant={!documentScopeEnabled ? "secondary" : "ghost"}
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => {
            setDocumentScopeEnabled(false);
            setThreadId(null);
          }}
        >
          Global
        </Button>
      </div>
    ) : null;

  const contextChips = (
    <div className="flex flex-wrap gap-1 px-1 py-1">
      {attachedRefs.map((r) => (
        <span
          key={`${r.type}-${r.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px]"
        >
          <span className="max-w-[140px] truncate">{docTitleMap.get(r.id) ?? r.id.slice(0, 8)}</span>
          {!(primaryDocumentId && r.id === primaryDocumentId) ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove context"
              onClick={() => void removeDocumentRef(r.id)}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );

  const docPicker = (
    <Popover open={docPickerOpen} onOpenChange={setDocPickerOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Add document to context">
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Search notes…"
          value={docSearch}
          onChange={(e) => setDocSearch(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filteredDocs.map((d) => (
            <button
              key={d.id}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => void addDocumentRef(d.id)}
            >
              <div className="truncate font-medium">{d.title?.trim() || "(untitled)"}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Type @ in the message field to attach a note. Issue/project context: reserved for later.
        </p>
      </PopoverContent>
    </Popover>
  );

  const threadStrip = (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 text-xs"
        onClick={() => void createThreadMut.mutateAsync("New thread")}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        New
      </Button>
      {threads.slice(0, layout === "sheet" ? 8 : 20).map((t) => (
        <Button
          key={t.id}
          type="button"
          variant={threadId === t.id ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-8 shrink-0 truncate text-xs", layout === "page" ? "max-w-[180px]" : "max-w-[140px]")}
          onClick={() => setThreadId(t.id)}
        >
          {t.title}
        </Button>
      ))}
    </div>
  );

  const messagesBlock =
    layout === "sheet" ? (
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {!threadId ? (
          <p className="text-xs text-muted-foreground">Pick a thread or start typing to create one.</p>
        ) : mergedMessages.length || showReasoning ? (
          <>
            {mergedMessages.map((m) => (
              <ChatMessageBubble key={m.id} message={m} onRate={handleRate} compact />
            ))}
            {showReasoning ? <ReasoningBubble compact /> : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        )}
        <div ref={endRef} />
      </div>
    ) : (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto p-4">
        {threadId ? (
          mergedMessages.length > 0 || showReasoning ? (
            <>
              {mergedMessages.map((m) => (
                <ChatMessageBubble key={m.id} message={m} onRate={handleRate} />
              ))}
              {showReasoning ? <ReasoningBubble /> : null}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">No messages yet.</div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">Select a thread or start a new conversation</p>
            <Button onClick={() => void createThreadMut.mutate("New conversation")}>
              <Plus className="h-4 w-4 mr-2" />
              New thread
            </Button>
          </div>
        )}
        <div ref={endRef} />
      </div>
    );

  const composer = (
    <div className="flex flex-col gap-1 border-t border-border p-3">
      {contextChips}
      <div className="flex gap-2">
        {docPicker}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message… (@ attach note)"
          className="h-9"
          disabled={busy}
          onKeyDown={onInputKeyDown}
        />
        <Button type="button" size="sm" className="h-9 shrink-0" disabled={busy || !input.trim()} onClick={() => void handleSend()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (layout === "sheet") {
    return (
      <>
        {showFullPageLink ? (
          <div className="flex justify-end border-b border-border px-3 py-1.5">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
              <Link to={fullChatHref} onClick={onClose}>
                <ExternalLink className="h-3.5 w-3.5" />
                Full page
              </Link>
            </Button>
          </div>
        ) : null}
        {scopeToggle ? <div className="border-b border-border px-3 py-2">{scopeToggle}</div> : null}
        {threadStrip}
        {messagesBlock}
        {composer}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 border-r border-border flex flex-col min-h-0">
        <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-sm">Threads</h2>
          <Button variant="ghost" size="sm" onClick={() => void createThreadMut.mutate("New conversation")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {projectIdFilter ? (
          <div className="m-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-muted-foreground shrink-0">
            <span className="font-medium text-foreground">Software factory scope</span> — threads here are tied to this
            project.
          </div>
        ) : null}

        {routeDocumentId && documentScopeEnabled ? (
          <div className="m-2 rounded-md border border-primary/25 bg-primary/5 p-2 text-xs text-muted-foreground shrink-0">
            <span className="font-medium text-foreground">Document scope</span> — RAG uses attached notes and 1-hop
            wikilink neighborhoods (capped), plus Mem0 and Vault.
          </div>
        ) : null}

        {routeDocumentId ? <div className="px-2 pb-2 shrink-0">{scopeToggle}</div> : null}

        {pendingNodeContext ? (
          <div className="m-2 rounded-md border border-primary/30 bg-primary/5 p-2 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary">Canvas context</span>
              {onClearPendingNodeContext ? (
                <button
                  type="button"
                  onClick={() => onClearPendingNodeContext()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{pendingNodeContext}</p>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto min-h-0">
          {threads.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No threads yet.</div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setThreadId(thread.id)}
                className={cn(
                  "w-full text-left p-3 border-b border-border hover:bg-muted/50",
                  threadId === thread.id ? "bg-muted" : "",
                )}
              >
                <div className="font-medium text-sm truncate">{thread.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(thread.updatedAt).toLocaleDateString()}</div>
              </button>
            ))
          )}
        </div>

        {showAgentsFooter ? (
          <div className="p-3 border-t border-border shrink-0">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Ask agent</h3>
            <div className="space-y-1">
              {agents.slice(0, 3).map((agent) => (
                <div key={agent.id} className="px-2 py-1 text-sm text-muted-foreground">
                  {agent.name}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {threadId ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
              <h1 className="font-semibold truncate">{threadData?.title}</h1>
              <div className="flex items-center gap-1 shrink-0">
                {showFullPageLink && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" asChild>
                    <Link to={fullChatHref} onClick={onClose}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Full page
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setThreadId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {messagesBlock}
            {composer}
          </>
        ) : (
          <>
            <div className="flex-1 flex flex-col min-h-0">{messagesBlock}</div>
            {composer}
          </>
        )}
      </div>
    </div>
  );
}
