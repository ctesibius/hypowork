/**
 * Chat Page - Phase 1.6: Chat with RAG + citations + rating
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { chatApi, type ChatThread, type ChatMessage } from "../api/chat";
import { agentsApi } from "../api/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { MessageCircle, Send, ThumbsUp, ThumbsDown, Star, X, Plus } from "lucide-react";

export function Chat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Handle canvas node context passed via URL (from "Ask about this" button)
  const [pendingNodeContext, setPendingNodeContext] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  // Read ?context= param from URL (set by canvas "Ask about this")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ctx = params.get("context");
    if (ctx) {
      // `URLSearchParams.get` already returns percent-decoded values — do not decode again
      // or strings containing `%` (e.g. JSON from canvas) throw URIError.
      setPendingNodeContext(ctx);
      // Pre-create a thread if none selected
      if (!selectedThreadId) {
        // Thread will be created on first send
      }
      // Clear the URL param without navigating away
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [selectedThreadId]);

  // Fetch threads
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: queryKeys.chat.threads(selectedCompanyId!),
    queryFn: () => chatApi.listThreads(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Fetch agents for "ask agent" feature
  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Fetch selected thread with messages
  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: queryKeys.chat.thread(selectedCompanyId!, selectedThreadId!),
    queryFn: () => chatApi.getThread(selectedCompanyId!, selectedThreadId!),
    enabled: !!selectedCompanyId && !!selectedThreadId,
  });

  // Create thread mutation
  const createThreadMut = useMutation({
    mutationFn: (title: string) =>
      chatApi.createThread(selectedCompanyId!, { title, type: "general" }),
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads(selectedCompanyId!) });
      setSelectedThreadId(thread.id);
    },
  });

  // Send message mutation
  const sendMessageMut = useMutation({
    mutationFn: async (params: { content: string; threadId: string }) =>
      chatApi.sendMessage(selectedCompanyId!, params.threadId, { content: params.content }),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chat.thread(selectedCompanyId!, vars.threadId),
      });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadData?.messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || streaming) return;

    // Auto-create thread if none selected but we have a pending context
    let threadId = selectedThreadId;
    if (!threadId) {
      const thread = await chatApi.createThread(selectedCompanyId!, {
        title: "Canvas conversation",
        type: "general",
      });
      setSelectedThreadId(thread.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads(selectedCompanyId!) });
      threadId = thread.id;
    }

    setStreaming(true);
    // Prepend node context if coming from canvas "Ask about this"
    const content = pendingNodeContext
      ? `About this canvas element:\n${pendingNodeContext}\n\n${messageInput.trim()}`
      : messageInput.trim();
    setMessageInput("");
    setPendingNodeContext(null);

    try {
      await sendMessageMut.mutateAsync({ content, threadId: threadId! });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleRate = async (messageId: string, thumbsUp: boolean, promptVersionId?: string) => {
    try {
      await chatApi.rateMessage(selectedCompanyId!, messageId, { thumbsUp, promptVersionId });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chat.thread(selectedCompanyId!, selectedThreadId!),
      });
    } catch (err) {
      console.error("Failed to rate message:", err);
    }
  };

  if (!selectedCompanyId) {
    return <EmptyState icon={MessageCircle} message="Select a company to use chat." />;
  }

  return (
    <div className="flex h-full">
      {/* Thread List Sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Threads</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => createThreadMut.mutate("New conversation")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Canvas node context banner — shown when navigated from "Ask about this" */}
        {pendingNodeContext && (
          <div className="m-2 rounded-md border border-primary/30 bg-primary/5 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary">Canvas context</span>
              <button
                onClick={() => setPendingNodeContext(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{pendingNodeContext}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : threads.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No threads yet. Start a new conversation.
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full text-left p-3 border-b border-border hover:bg-muted/50 ${
                  selectedThreadId === thread.id ? "bg-muted" : ""
                }`}
              >
                <div className="font-medium text-sm truncate">{thread.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Agent Quick Access */}
        <div className="p-3 border-t border-border">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Ask Agent</h3>
          <div className="space-y-1">
            {agents.slice(0, 3).map((agent) => (
              <button
                key={agent.id}
                className="w-full text-left px-2 py-1 text-sm rounded hover:bg-muted/50"
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedThreadId ? (
          <>
            {/* Thread Header */}
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h1 className="font-semibold">{threadData?.title}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedThreadId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {threadLoading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : threadData?.messages && threadData.messages.length > 0 ? (
                threadData.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onRate={handleRate}
                  />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet. Start the conversation!
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={streaming}
                  className="flex-1"
                />
                <Button onClick={() => void handleSendMessage()} disabled={streaming || !messageInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {streaming && (
                <div className="text-xs text-muted-foreground mt-2">
                  Generating response...
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Chat</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Select a thread or start a new conversation
              </p>
              <Button onClick={() => createThreadMut.mutate("New conversation")}>
                <Plus className="h-4 w-4 mr-2" />
                New Thread
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onRate: (messageId: string, thumbsUp: boolean, promptVersionId?: string) => void;
}

function MessageBubble({ message, onRate }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="text-xs font-medium mb-1">Sources:</div>
            {message.citations.map((citation, idx) => (
              <div key={idx} className="text-xs text-muted-foreground">
                {citation.sourceTitle}
              </div>
            ))}
          </div>
        )}

        {/* Rating */}
        {!isUser && (
          <div className="mt-2 pt-2 border-t border-border/50 flex gap-2">
            <button
              onClick={() => onRate(message.id, true, message.promptVersionId)}
              className="text-xs hover:bg-primary/10 rounded p-1"
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onRate(message.id, false, message.promptVersionId)}
              className="text-xs hover:bg-primary/10 rounded p-1"
              title="Not helpful"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
            <div className="flex gap-0.5 ml-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-3 w-3 text-muted-foreground/50" />
              ))}
            </div>
          </div>
        )}

        <div className="text-xs opacity-50 mt-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
