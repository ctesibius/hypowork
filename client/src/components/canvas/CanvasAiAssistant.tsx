import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MessageSquare, Minimize2, Send, Sparkles } from "lucide-react";
import { useNavigate } from "@/lib/router";
import {
  chatApi,
  type CanvasNodeContextForChat,
  type ChatMessage,
  type ChatThread,
} from "../../api/chat";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildCanvasNeighborContext,
  serializeCanvasGraphForChat,
  toChatNodeContext,
} from "./canvasChatContext";

const THREAD_STORAGE_PREFIX = "hypowork.canvasAiThread";

function threadStorageKey(companyId: string, documentId: string | null | undefined) {
  return `${THREAD_STORAGE_PREFIX}:${companyId}:${documentId ?? "company-canvas"}`;
}

export type CanvasAiAssistantProps = {
  companyId: string;
  documentId?: string | null;
  documentTitle?: string | null;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  disabled?: boolean;
};

export function CanvasAiAssistant({
  companyId,
  documentId,
  documentTitle,
  nodes,
  edges,
  selectedNodeId,
  disabled = false,
}: CanvasAiAssistantProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [scope, setScope] = useState<"board" | "selection">("board");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [showReasoning, setShowReasoning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(
    () => threadStorageKey(companyId, documentId ?? null),
    [companyId, documentId],
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setThreadId(raw);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const persistThreadId = useCallback(
    (id: string | null) => {
      setThreadId(id);
      try {
        if (id) sessionStorage.setItem(storageKey, id);
        else sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const { data: threadData } = useQuery({
    queryKey: queryKeys.chat.thread(companyId, threadId!),
    queryFn: () => chatApi.getThread(companyId, threadId!),
    enabled: !!companyId && !!threadId && expanded,
  });

  const messages: ChatMessage[] = threadData?.messages ?? [];
  const mergedMessages: ChatMessage[] = [...messages, ...optimisticMessages];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, optimisticMessages.length, showReasoning, expanded]);

  useEffect(() => {
    if (!expanded) {
      setOptimisticMessages([]);
      setShowReasoning(false);
    }
  }, [expanded]);

  const selectionCtx = useMemo(
    () => buildCanvasNeighborContext(nodes, edges, selectedNodeId),
    [nodes, edges, selectedNodeId],
  );

  const nodeContextPayload: CanvasNodeContextForChat | null = useMemo(
    () => toChatNodeContext(selectionCtx),
    [selectionCtx],
  );

  const ensureThread = useCallback(async (): Promise<string> => {
    if (threadId) return threadId;
    const thread: ChatThread = await chatApi.createThread(companyId, {
      title: documentId ? `Canvas · ${documentTitle?.trim() || "Note"}` : "Company canvas",
      type: documentId ? "document" : "general",
      scope: documentId ? "document" : "company",
      documentId: documentId ?? undefined,
    });
    persistThreadId(thread.id);
    void queryClient.invalidateQueries({ queryKey: ["chat", companyId, "threads"] });
    return thread.id;
  }, [threadId, companyId, documentId, documentTitle, persistThreadId, queryClient]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy || disabled) return;
    setBusy(true);
    setInput("");
    try {
      const tid = await ensureThread();
      const useSelection = scope === "selection" && nodeContextPayload;
      const content = useSelection
        ? text
        : [
            "The user is asking in the context of this canvas board:",
            "",
            serializeCanvasGraphForChat(documentTitle ?? null, documentId ?? null, nodes, edges),
            "",
            "---",
            "",
            text,
          ].join("\n");
      const optimisticUserMessage: ChatMessage = {
        id: `optimistic-canvas-${Date.now()}`,
        threadId: tid,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticUserMessage]);
      setShowReasoning(true);

      if (useSelection) {
        await chatApi.sendMessageWithCanvasContext(companyId, tid, {
          content,
          nodeContext: nodeContextPayload,
        });
      } else {
        await chatApi.sendMessage(companyId, tid, { content });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(companyId, tid) });
      setOptimisticMessages([]);
      setShowReasoning(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRate = async (messageId: string, thumbsUp: boolean, promptVersionId?: string) => {
    try {
      await chatApi.rateMessage(companyId, messageId, { thumbsUp, promptVersionId });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(companyId, threadId!) });
    } catch {
      /* ignore */
    }
  };

  if (disabled) return null;

  return (
    <Panel position="bottom-right" className="m-2 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-2">
      {expanded ? (
        <div className="flex w-[min(100%,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/98 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-semibold">Canvas assistant</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => navigate("../chat")}
                title="Open full Chat"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExpanded(false)}
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border-b border-border px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Scope</div>
            <div className="mt-1 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={scope === "board" ? "secondary" : "ghost"}
                className="h-7 flex-1 text-xs"
                onClick={() => setScope("board")}
              >
                Whole board
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === "selection" ? "secondary" : "ghost"}
                className="h-7 flex-1 text-xs"
                disabled={!selectedNodeId}
                onClick={() => setScope("selection")}
                title={!selectedNodeId ? "Select a node on the canvas" : undefined}
              >
                Selection
              </Button>
            </div>
          </div>

          <div className="max-h-[min(320px,40vh)] space-y-2 overflow-y-auto px-3 py-2">
            {mergedMessages.length === 0 && !showReasoning ? (
              <p className="text-xs text-muted-foreground">
                Ask about this canvas. Uses the same RAG-backed chat as the full Chat page. Scope{" "}
                <strong className="text-foreground">Selection</strong> uses the selected node and its neighbors.
              </p>
            ) : (
              <>
                {mergedMessages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-md px-2 py-1.5 text-xs ${m.role === "user" ? "ml-6 bg-primary/15" : "mr-4 bg-muted/80"}`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                    <div className="mt-1 border-t border-border/50 pt-1 text-[10px] text-muted-foreground">
                      {m.citations.slice(0, 4).map((c, i) => (
                        <div key={i}>{c.sourceTitle}</div>
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && (
                    <div className="mt-1 flex gap-1 border-t border-border/40 pt-1">
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => void handleRate(m.id, true, m.promptVersionId)}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => void handleRate(m.id, false, m.promptVersionId)}
                      >
                        👎
                      </button>
                    </div>
                  )}
                </div>
                ))}
                {showReasoning ? (
                  <div className="rounded-md px-2 py-1.5 text-xs mr-4 bg-muted/80 border border-border/60 text-muted-foreground">
                    Reasoning...
                  </div>
                ) : null}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2 border-t border-border p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message…"
              className="h-9 text-sm"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button type="button" size="sm" className="h-9 shrink-0" disabled={busy || !input.trim()} onClick={() => void handleSend()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="h-12 w-12 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-md"
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? "Hide assistant" : "Canvas assistant"}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    </Panel>
  );
}
