import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import type { CompanyDocument } from "../api/documents";
import { FileText } from "lucide-react";

interface DocumentRowProps {
  document: CompanyDocument;
  documentLinkState?: unknown;
  mobileLeading?: ReactNode;
  desktopMetaLeading?: ReactNode;
  desktopLeadingSpacer?: boolean;
  mobileMeta?: ReactNode;
  desktopTrailing?: ReactNode;
  trailingMeta?: ReactNode;
  className?: string;
}

export function DocumentRow({
  document: doc,
  documentLinkState,
  mobileLeading,
  desktopMetaLeading,
  desktopLeadingSpacer = false,
  mobileMeta,
  desktopTrailing,
  trailingMeta,
  className,
}: DocumentRowProps) {
  const shortId = doc.id.slice(0, 8);
  const title = doc.title?.trim() || "Untitled";

  return (
    <Link
      to={`/documents/${doc.id}`}
      state={documentLinkState}
      className={cn(
        "flex items-start gap-2 border-b border-border py-2.5 pl-2 pr-3 text-sm no-underline text-inherit transition-colors hover:bg-accent/50 last:border-b-0 sm:items-center sm:py-2 sm:pl-1",
        className,
      )}
    >
      <span className="shrink-0 pt-px sm:hidden">
        {mobileLeading ?? <FileText className="h-4 w-4 text-muted-foreground" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
        <span className="line-clamp-2 text-sm sm:order-2 sm:min-w-0 sm:flex-1 sm:truncate sm:line-clamp-none">
          {title}
        </span>
        <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
          {desktopLeadingSpacer ? (
            <span className="hidden w-3.5 shrink-0 sm:block" />
          ) : null}
          {desktopMetaLeading ?? (
            <>
              <span className="hidden sm:inline-flex">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{shortId}</span>
            </>
          )}
          {mobileMeta ? (
            <>
              <span className="text-xs text-muted-foreground sm:hidden" aria-hidden="true">
                &middot;
              </span>
              <span className="text-xs text-muted-foreground sm:hidden">{mobileMeta}</span>
            </>
          ) : null}
        </span>
      </span>
      {(desktopTrailing || trailingMeta) ? (
        <span className="ml-auto hidden shrink-0 items-center gap-2 sm:order-3 sm:flex sm:gap-3">
          {desktopTrailing}
          {trailingMeta ? (
            <span className="text-xs text-muted-foreground">{trailingMeta}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
