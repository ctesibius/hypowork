import { useMemo } from "react";
import { useLocation } from "@/lib/router";
import { MessageCircle } from "lucide-react";
import { parseDocumentIdFromPathname } from "../lib/parse-document-id-from-path";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "../lib/utils";
import { CompanyChatWorkspace } from "./chat/CompanyChatWorkspace";

type GlobalChatSheetProps = {
  companyId: string | null;
  /** Company issue prefix for `/…/chat` link (optional if pathname already scoped). */
  companyPrefix: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Omnipresent chat shell (Phase 1.6): FAB + slide-over; shares core with full `/chat` page.
 */
export function GlobalChatSheet({ companyId, companyPrefix, open, onOpenChange }: GlobalChatSheetProps) {
  const location = useLocation();
  const onChatRoute = /\/chat\/?$/.test(location.pathname);

  const activeDocumentId = useMemo(
    () => parseDocumentIdFromPathname(location.pathname) ?? null,
    [location.pathname],
  );

  const fullPageSearch = useMemo(() => {
    if (!activeDocumentId) return "";
    return `document=${encodeURIComponent(activeDocumentId)}`;
  }, [activeDocumentId]);

  if (!companyId || onChatRoute) {
    return null;
  }

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
            <SheetTitle className="text-base">Chat</SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CompanyChatWorkspace
              companyId={companyId}
              companyPrefix={companyPrefix}
              layout="sheet"
              routeDocumentId={activeDocumentId}
              sheetOpen={open}
              showFullPageLink
              fullPageSearch={fullPageSearch}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
