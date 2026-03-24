/**
 * Chat Page - Phase 1.6: full-screen host for the same workspace as the floating panel.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { parseDocumentIdFromSearch } from "../lib/parse-document-id-from-path";
import { EmptyState } from "../components/EmptyState";
import { MessageCircle } from "lucide-react";
import { CompanyChatWorkspace } from "../components/chat/CompanyChatWorkspace";

export function Chat() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const chatProjectId = searchParams.get("project")?.trim() || undefined;
  const chatDocumentId = useMemo(
    () => parseDocumentIdFromSearch(location.search),
    [location.search],
  );

  const [pendingNodeContext, setPendingNodeContext] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ctx = params.get("context");
    if (!ctx) return;
    setPendingNodeContext(ctx);
    params.delete("context");
    const q = params.toString();
    const newUrl = q ? `${window.location.pathname}?${q}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, []);

  const fullPageSearch = useMemo(() => {
    const p = new URLSearchParams();
    if (chatProjectId) p.set("project", chatProjectId);
    if (chatDocumentId) p.set("document", chatDocumentId);
    return p.toString();
  }, [chatProjectId, chatDocumentId]);

  if (!selectedCompanyId) {
    return <EmptyState icon={MessageCircle} message="Select a company to use chat." />;
  }

  return (
    <CompanyChatWorkspace
      companyId={selectedCompanyId}
      companyPrefix={selectedCompany?.issuePrefix ?? null}
      layout="page"
      routeDocumentId={chatDocumentId ?? null}
      projectIdFilter={chatProjectId ?? null}
      sheetOpen
      showFullPageLink={false}
      fullPageSearch={fullPageSearch}
      showAgentsFooter
      pendingNodeContext={pendingNodeContext}
      onClearPendingNodeContext={() => setPendingNodeContext(null)}
    />
  );
}
