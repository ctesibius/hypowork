import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  Panel,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  FileText,
  FileType2,
  GitBranch,
  LayoutGrid,
  LayoutTemplate,
  Magnet,
  PenLine,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { documentsApi } from "../../api/documents";
import type { issuesApi } from "../../api/issues";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { randomUuid } from "../../lib/randomUuid";

type CanvasToolbarProps = {
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  docs: Awaited<ReturnType<typeof documentsApi.list>> | undefined;
  issues: Awaited<ReturnType<typeof issuesApi.list>> | undefined;
  onClear: () => void;
  toolbarTitle: string;
  toolbarHint?: string;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;
  /** When true, only the left tool rail is shown (top duplicate strip is hidden). */
  hideTopToolbar?: boolean;
};

/**
 * Hypopedia-style chrome: docked **left tool rail** + **top bar** (tools, title, hints).
 */
export function HypoworkCanvasToolbar({
  setNodes,
  setEdges: _setEdges,
  docs,
  issues,
  onClear,
  toolbarTitle,
  toolbarHint,
  snapToGrid = false,
  onToggleSnapToGrid,
  hideTopToolbar = false,
}: CanvasToolbarProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [pickDocId, setPickDocId] = useState("");
  const [pickIssueId, setPickIssueId] = useState("");

  const centerPos = useCallback(() => {
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }, [screenToFlowPosition]);

  const addSticky = () => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "sticky",
        position: pos,
        data: { body: "" },
      },
    ]);
  };

  const addDocPageCard = () => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "docPage",
        position: pos,
        data: { body: "", title: "Untitled page", isPrimaryDocument: false },
      },
    ]);
  };

  const addStage = (label: string) => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "stage",
        position: pos,
        data: { label },
      },
    ]);
  };

  const addSketch = () => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "sketch",
        position: pos,
        data: { body: "" },
      },
    ]);
  };

  const addFrame = () => {
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "frame",
        position: pos,
        style: { width: 320, height: 220 },
        data: { label: "Frame" },
      },
    ]);
  };

  const addDocRef = () => {
    if (!pickDocId) return;
    const d = docs?.find((x) => x.id === pickDocId);
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "docRef",
        position: pos,
        data: {
          documentId: pickDocId,
          title: d?.title?.trim() || "Untitled",
        },
      },
    ]);
    setDocPickerOpen(false);
    setPickDocId("");
  };

  const addIssueRef = () => {
    if (!pickIssueId) return;
    const i = issues?.find((x) => x.id === pickIssueId);
    const pos = centerPos();
    setNodes((nds) => [
      ...nds,
      {
        id: randomUuid(),
        type: "issueRef",
        position: pos,
        data: {
          issueId: pickIssueId,
          identifier: i?.identifier ?? null,
          title: i?.title ?? "",
        },
      },
    ]);
    setIssuePickerOpen(false);
    setPickIssueId("");
  };

  return (
    <>
      <Panel
        position="top-left"
        className="!mt-0 ml-2 flex flex-col gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{ top: "50%", transform: "translateY(-50%)" }}
      >
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Sticky note" onClick={addSticky}>
          <StickyNote className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Page card" onClick={addDocPageCard}>
          <FileType2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Link document" onClick={() => setDocPickerOpen(true)}>
          <FileText className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Link issue" onClick={() => setIssuePickerOpen(true)}>
          <GitBranch className="h-4 w-4 text-violet-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Sketch" onClick={addSketch}>
          <PenLine className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Frame" onClick={addFrame}>
          <LayoutTemplate className="h-4 w-4" />
        </Button>
        {onToggleSnapToGrid ? (
          <Button
            size="icon"
            variant={snapToGrid ? "secondary" : "ghost"}
            className="h-9 w-9"
            title="Snap to grid"
            onClick={onToggleSnapToGrid}
          >
            <Magnet className="h-4 w-4" />
          </Button>
        ) : null}
        <div className="my-1 border-t border-border" />
        <Button size="icon" variant="ghost" className="h-9 w-9 text-[10px] font-semibold" title="PDR stage" onClick={() => addStage("PDR")}>
          P
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 text-[10px] font-semibold" title="CDR stage" onClick={() => addStage("CDR")}>
          C
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 text-[10px] font-semibold" title="TRR stage" onClick={() => addStage("TRR")}>
          T
        </Button>
        <div className="my-1 border-t border-border" />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-destructive hover:text-destructive"
          title="Clear board"
          onClick={onClear}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Panel>

      {!hideTopToolbar ? (
        <Panel position="top-center" className="m-0 w-full max-w-none">
          <div className="mx-auto flex flex-wrap items-center justify-center gap-2 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">{toolbarTitle}</span>
            {toolbarHint ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">{toolbarHint}</span>
            ) : null}
            <div className="flex w-full flex-wrap items-center justify-center gap-1 sm:ml-auto sm:w-auto">
              <Button size="sm" variant="outline" onClick={addSticky}>
                <StickyNote className="mr-1 h-3.5 w-3.5" />
                Note
              </Button>
              <Button size="sm" variant="outline" onClick={addDocPageCard} title="Page card (Hypopedia-style)">
                <FileType2 className="mr-1 h-3.5 w-3.5" />
                Page
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDocPickerOpen(true)}>
                <FileText className="mr-1 h-3.5 w-3.5" />
                Document
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIssuePickerOpen(true)}>
                <GitBranch className="mr-1 h-3.5 w-3.5" />
                Issue
              </Button>
              <Button size="sm" variant="outline" onClick={addSketch}>
                <PenLine className="mr-1 h-3.5 w-3.5" />
                Sketch
              </Button>
              <Button size="sm" variant="outline" onClick={addFrame}>
                <LayoutTemplate className="mr-1 h-3.5 w-3.5" />
                Frame
              </Button>
              {onToggleSnapToGrid ? (
                <Button size="sm" variant={snapToGrid ? "secondary" : "outline"} onClick={onToggleSnapToGrid}>
                  <Magnet className="mr-1 h-3.5 w-3.5" />
                  Snap
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => addStage("PDR")}>
                + PDR
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addStage("CDR")}>
                + CDR
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addStage("TRR")}>
                + TRR
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={onClear}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <Dialog open={docPickerOpen} onOpenChange={setDocPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document card</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pick-doc">Document</Label>
            <select
              id="pick-doc"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pickDocId}
              onChange={(e) => setPickDocId(e.target.value)}
            >
              <option value="">Select…</option>
              {(docs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.title?.trim() || "Untitled").slice(0, 80)}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocPickerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addDocRef} disabled={!pickDocId}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issuePickerOpen} onOpenChange={setIssuePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add issue card</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pick-issue">Issue</Label>
            <select
              id="pick-issue"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pickIssueId}
              onChange={(e) => setPickIssueId(e.target.value)}
            >
              <option value="">Select…</option>
              {(issues ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.identifier} — {i.title}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssuePickerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addIssueRef} disabled={!pickIssueId}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
