import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThumbsDown, ThumbsUp, Star } from "lucide-react";
import type { ChatMessage } from "../../api/chat";

export function ReasoningBubble({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "rounded-md px-2 py-1.5 text-xs mr-2 bg-muted/80 border border-border/60 text-muted-foreground" : "flex justify-start"}>
      {compact ? (
        "Reasoning..."
      ) : (
        <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted border border-border/60">
          <div className="text-sm text-muted-foreground">Reasoning...</div>
        </div>
      )}
    </div>
  );
}

type MessageBubbleProps = {
  message: ChatMessage;
  onRate: (messageId: string, thumbsUp: boolean, promptVersionId?: string) => void;
  compact?: boolean;
};

export function ChatMessageBubble({ message, onRate, compact }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (compact) {
    return (
      <div className={`rounded-md px-2 py-1.5 text-xs ${isUser ? "ml-4 bg-primary/12" : "mr-2 bg-muted/80"}`}>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:bg-background prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:text-xs">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 not-prose">
                    {children}
                  </pre>
                ),
                code: ({ className, children, ...props }) => {
                  const isBlock = Boolean(className?.includes("language-"));
                  return isBlock ? (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code
                      className="rounded bg-background/80 px-1 py-0.5 text-[0.85em] not-prose"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

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

        {!isUser && (
          <div className="mt-2 pt-2 border-t border-border/50 flex gap-2">
            <button
              type="button"
              onClick={() => onRate(message.id, true, message.promptVersionId)}
              className="text-xs hover:bg-primary/10 rounded p-1"
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              type="button"
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

        <div className="text-xs opacity-50 mt-1">{new Date(message.createdAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
