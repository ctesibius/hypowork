import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { LayoutGrid } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { CompanyCanvasBoard } from "../components/canvas/CompanyCanvasBoard";
import { EmptyState } from "../components/EmptyState";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";

export function CompanyCanvas() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Canvas" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) {
    return <EmptyState icon={LayoutGrid} message="Select a company to open the canvas." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">Prefer canvas documents</span> — create a spatial board per
          note under <span className="font-medium text-foreground">Documents</span> (&quot;New canvas&quot;). This page is
          the legacy single board per company.
        </p>
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link to="/documents">Open documents</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Infinite pan/zoom board: notes, company documents, issues, quick lifecycle stages (PDR/CDR/TRR), and sketch
        boxes. Connect nodes with edges for Visio-style flows. Persists via the company canvas API (legacy); canvas
        documents store graph JSON on each document row.
      </p>
      <ReactFlowProvider key={selectedCompanyId}>
        <CompanyCanvasBoard />
      </ReactFlowProvider>
    </div>
  );
}
