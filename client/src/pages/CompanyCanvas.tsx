import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { LayoutGrid } from "lucide-react";
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
      <p className="text-sm text-muted-foreground">
        Infinite pan/zoom board: notes, company documents, issues, quick lifecycle stages (PDR/CDR/TRR), and sketch
        boxes. Connect nodes with edges for Visio-style flows. Matches{" "}
        <span className="font-medium text-foreground">ProjectPlan</span> canvas direction; persistence is
        browser-local until server sync lands in a later phase.
      </p>
      <ReactFlowProvider key={selectedCompanyId}>
        <CompanyCanvasBoard />
      </ReactFlowProvider>
    </div>
  );
}
