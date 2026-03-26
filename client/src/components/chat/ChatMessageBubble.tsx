import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThumbsDown, ThumbsUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "../../api/chat";

const markdownComponents = {
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 not-prose">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code">) => {
    const isBlock = Boolean(className?.includes("language-"));
    return isBlock ? (
      <code className={className} {...props}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-background/80 px-1 py-0.5 text-[0.85em] not-prose" {...props}>
        {children}
      </code>
    );
  },
};

function AssistantMarkdownBody({ content, compact }: { content: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none prose-pre:bg-background prose-pre:border prose-pre:border-border prose-pre:rounded-md",
        compact
          ? "prose-sm text-xs prose-p:my-1 prose-headings:my-1 prose-headings:text-sm prose-ul:my-0.5 prose-ol:my-0.5 prose-pre:text-[11px] leading-snug"
          : "prose-sm text-sm prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:text-xs",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

type RateHandler = (messageId: string, thumbsUp: boolean, promptVersionId?: string) => void;

function MessageMeta({
  message,
  onRate,
  compact,
}: {
  message: ChatMessage;
  onRate: RateHandler;
  compact?: boolean;
}) {
  const isUser = message.role === "user";
  if (isUser) return null;

  return (
    <>
      {message.citations && message.citations.length > 0 && (
        <div className={cn("border-t border-border/50", compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2")}>
          <div className={cn("font-medium mb-1", compact ? "text-[10px]" : "text-xs")}>Sources:</div>
          {message.citations.map((citation, idx) => (
            <div key={idx} className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
              {citation.sourceTitle}
            </div>
          ))}
        </div>
      )}

      <div className={cn("border-t border-border/50 flex gap-2", compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2")}>
        <button
          type="button"
          onClick={() => onRate(message.id, true, message.promptVersionId)}
          className={cn("hover:bg-primary/10 rounded p-1", compact ? "text-[10px]" : "text-xs")}
          title="Helpful"
        >
          <ThumbsUp className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
        <button
          type="button"
          onClick={() => onRate(message.id, false, message.promptVersionId)}
          className={cn("hover:bg-primary/10 rounded p-1", compact ? "text-[10px]" : "text-xs")}
          title="Not helpful"
        >
          <ThumbsDown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
        <div className="flex gap-0.5 ml-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn("text-muted-foreground/50", compact ? "h-2.5 w-2.5" : "h-3 w-3")}
            />
          ))}
        </div>
      </div>

      <div className={cn("opacity-50 mt-1", compact ? "text-[10px]" : "text-xs")}>
        {new Date(message.createdAt).toLocaleTimeString()}
      </div>
    </>
  );
}

export function ReasoningBubble({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-md px-2 py-1.5 text-xs mr-2 bg-muted/80 border border-border/60 text-muted-foreground"
          : "flex justify-start"
      }
    >
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
  onRate: RateHandler;
  compact?: boolean;
};

export function ChatMessageBubble({ message, onRate, compact }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-md px-2 py-1.5 text-xs",
          isUser ? "ml-4 bg-primary/12" : "mr-2 bg-muted/80",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <>
            <AssistantMarkdownBody content={message.content} compact />
            <MessageMeta message={message} onRate={onRate} compact />
          </>
        )}
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
          <>
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
            <div className="text-xs opacity-50 mt-1">{new Date(message.createdAt).toLocaleTimeString()}</div>
          </>
        ) : (
          <>
            <AssistantMarkdownBody content={message.content} />
            <MessageMeta message={message} onRate={onRate} />
          </>
        )}
      </div>
    </div>
  );
}
