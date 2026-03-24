import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { plcApi, type PlcStageNode, type PlcStageEdge, type PlcStagesGraph } from "../api/plc";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, ArrowRight, Settings, GripVertical } from "lucide-react";

type StageEditor = {
  id: string;
  label: string;
  kind: "gate" | "phase" | "checkpoint";
  description: string;
};

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function stagesToNodes(stages: StageEditor[]): PlcStageNode[] {
  return stages.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind as "gate" | "phase" | "checkpoint",
    description: s.description || undefined,
  }));
}

function buildGraph(nodes: PlcStageNode[], ordered: string[]): PlcStagesGraph {
  const nodeIds = new Set(ordered);
  const edges: PlcStageEdge[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1]!;
    const to = ordered[i]!;
    if (nodeIds.has(from) && nodeIds.has(to)) {
      edges.push({ from, to });
    }
  }
  return { nodes, edges };
}

function PlcTemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: {
    id: string;
    name: string;
    description: string | null;
    stages: PlcStagesGraph;
  };
  onSave: (data: { name: string; description: string | null; stages: PlcStagesGraph }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [nodes, setNodes] = useState<StageEditor[]>(
    initial?.stages.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      description: n.description ?? "",
    })) ?? [],
  );

  function addNode() {
    setNodes((prev) => [
      ...prev,
      { id: makeId("node"), label: "", kind: "gate", description: "" },
    ]);
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }

  function updateNode(id: string, patch: Partial<StageEditor>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function handleSave() {
    if (!name.trim()) return;
    const validNodes = nodes.filter((n) => n.label.trim());
    const ordered = validNodes.map((n) => n.id);
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      stages: buildGraph(stagesToNodes(validNodes), ordered),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit PLC template" : "New PLC template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard SW PLC"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description…"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Stages (in order)</label>
              <Button type="button" variant="outline" size="sm" onClick={addNode}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add stage
              </Button>
            </div>
            {nodes.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded">
                No stages yet. Click "Add stage" to begin.
              </p>
            )}
            <div className="space-y-2">
              {nodes.map((node, idx) => (
                <div key={node.id} className="flex items-start gap-2 p-2 border rounded-md bg-card">
                  <GripVertical className="h-4 w-4 mt-2 text-muted-foreground shrink-0" />
                  <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "1fr auto 1fr auto" }}>
                    <Input
                      placeholder="Label (e.g. PDR)"
                      value={node.label}
                      onChange={(e) => updateNode(node.id, { label: e.target.value })}
                      className="text-sm"
                    />
                    <Select
                      value={node.kind}
                      onValueChange={(v) => updateNode(node.id, { kind: v as StageEditor["kind"] })}
                    >
                      <SelectTrigger className="w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gate">gate</SelectItem>
                        <SelectItem value="phase">phase</SelectItem>
                        <SelectItem value="checkpoint">checkpoint</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description (optional)"
                      value={node.description}
                      onChange={(e) => updateNode(node.id, { description: e.target.value })}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeNode(node.id)}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {nodes.length >= 2 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                Edges connect stages in order (top → bottom)
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!name.trim()}>
            {initial ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlcTemplatesSettings() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [editingTemplate, setEditingTemplate] = useState<
    { id: string; name: string; description: string | null; stages: PlcStagesGraph } | undefined
  >();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Settings" }, { label: "PLC Lifecycle Templates" }]);
  }, [setBreadcrumbs]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["plc-templates", selectedCompanyId ?? "__none__"],
    queryFn: () => plcApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; stages: PlcStagesGraph }) =>
      plcApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plc-templates", selectedCompanyId] });
      setShowCreate(false);
      pushToast({ title: "Template created", tone: "success" });
    },
    onError: (e: Error) => {
      pushToast({ title: e.message || "Could not create template", tone: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; description: string | null; stages: PlcStagesGraph };
    }) => plcApi.patch(selectedCompanyId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plc-templates", selectedCompanyId] });
      setEditingTemplate(undefined);
      pushToast({ title: "Template updated", tone: "success" });
    },
    onError: (e: Error) => {
      pushToast({ title: e.message || "Could not update template", tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plcApi.delete(selectedCompanyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plc-templates", selectedCompanyId] });
      pushToast({ title: "Template deleted", tone: "success" });
    },
    onError: (e: Error) => {
      pushToast({ title: e.message || "Could not delete template", tone: "error" });
    },
  });

  if (!selectedCompanyId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a company to manage PLC templates.
      </div>
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">PLC Lifecycle Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define project lifecycle graphs (e.g. SRR → PDR → CDR → TRR) and bind them to projects.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Settings className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No PLC templates yet.</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{t.name}</h3>
                  {t.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {t.stages.nodes.map((node) => (
                      <span
                        key={node.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                          node.kind === "gate"
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : node.kind === "phase"
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        {node.kind === "gate" && "⏳ "}
                        {node.kind === "phase" && "▶ "}
                        {node.kind === "checkpoint" && "✓ "}
                        {node.label}
                      </span>
                    ))}
                    {t.stages.edges.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t.stages.edges.length} transition{t.stages.edges.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditingTemplate({
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        stages: t.stages,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (window.confirm(`Delete "${t.name}"? This cannot be undone.`)) {
                        deleteMutation.mutate(t.id);
                      }
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <PlcTemplateForm
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {editingTemplate && (
        <PlcTemplateForm
          initial={editingTemplate}
          onSave={(data) =>
            updateMutation.mutate({ id: editingTemplate.id, data })
          }
          onCancel={() => setEditingTemplate(undefined)}
        />
      )}
    </div>
  );
}
