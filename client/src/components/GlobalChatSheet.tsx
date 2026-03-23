import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MessageCircle, Plus, Send } from "lucide-react";
import { chatApi, type ChatMessage } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "../lib/utils";

type GlobalChatSheetProps = {
  companyId: string | null;
  /** Company issue prefix for `/…/chat` link (optional if pathname already scoped). */
  companyPrefix: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Omnipresent chat shell (Phase 1.6): slide-over using the same Chat APIs as `/chat`.
 */
export function GlobalChatSheet({ companyId, companyPrefix, open, onOpenChange }: GlobalChatSheetProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [showReasoning, setShowReasoning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const onChatRoute = /\/chat\/?$/.test(location.pathname);

  const { data: threads = [] } = useQuery({
    queryKey: queryKeys.chat.threads(companyId!, null),
    queryFn: () => chatApi.listThreads(companyId!),
    enabled: !!companyId && open,
  });

  const { data: threadData } = useQuery({
    queryKey: queryKeys.chat.thread(companyId!, threadId!),
    queryFn: () => chatApi.getThread(companyId!, threadId!),
    enabled: !!companyId && !!threadId && open,
  });

  const createThreadMut = useMutation({
    mutationFn: (title: string) => chatApi.createThread(companyId!, { title, type: "general" }),
    onSuccess: (t) => {
      setThreadId(t.id);
      void queryClient.invalidateQueries({ queryKey: ["chat", companyId!, "threads"] });
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadData?.messages, optimisticMessages, showReasoning, open]);

  useEffect(() => {
    if (!open) {
      setOptimisticMessages([]);
      setShowReasoning(false);
    }
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !companyId || busy) return;
    setBusy(true);
    setInput("");
    try {
      let tid = threadId;
      if (!tid) {
        const t = await chatApi.createThread(companyId, { title: text.slice(0, 48), type: "general" });
        tid = t.id;
        setThreadId(tid);
        void queryClient.invalidateQueries({ queryKey: ["chat", companyId, "threads"] });
      }
      const optimisticUserMessage: ChatMessage = {
        id: `optimistic-sheet-${Date.now()}`,
        threadId: tid,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticUserMessage]);
      setShowReasoning(true);
      await chatApi.sendMessage(companyId, tid, { content: text });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(companyId, tid) });
      setOptimisticMessages([]);
      setShowReasoning(false);
    } finally {
      setBusy(false);
    }
  };

  const mergedMessages = [...(threadData?.messages ?? []), ...optimisticMessages];

  if (!companyId || onChatRoute) {
    return null;
  }

  const fullChatTo = companyPrefix ? `/${companyPrefix}/chat` : "/chat";

  return (
    <>
      <Button
        type="button"
        size="icon"
        className={cn(
          "fixed z-40 h-12 w-12 rounded-full border border-primary/25 bg-primary text-primary-foreground shadow-lg",
          "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6",
          open && "pointer-events-none opacity-0",
        )}
        onClick={() => onOpenChange(true)}
        title="Open chat (⌘⇧C)"
        aria-label="Open chat panel"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-[min(100vw,400px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-2 pr-8">
              <SheetTitle className="text-base">Chat</SheetTitle>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 text-xs" asChild>
                <Link to={fullChatTo} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Full page
                </Link>
              </Button>
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
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
              {threads.slice(0, 8).map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant={threadId === t.id ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 max-w-[140px] shrink-0 truncate text-xs"
                  onClick={() => setThreadId(t.id)}
                >
                  {t.title}
                </Button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
              {!threadId ? (
                <p className="text-xs text-muted-foreground">Pick a thread or start typing to create one.</p>
              ) : mergedMessages.length || showReasoning ? (
                <>
                  {mergedMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md px-2 py-1.5 text-xs ${
                        m.role === "user" ? "ml-4 bg-primary/12" : "mr-2 bg-muted/80"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))}
                  {showReasoning ? (
                    <div className="rounded-md px-2 py-1.5 text-xs mr-2 bg-muted/80 border border-border/60 text-muted-foreground">
                      Reasoning...
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No messages yet.</p>
              )}
              <div ref={endRef} />
            </div>

            <div className="flex gap-2 border-t border-border p-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message…"
                className="h-9"
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
        </SheetContent>
      </Sheet>
    </>
  );
}
