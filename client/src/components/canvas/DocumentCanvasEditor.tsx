import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { HelpCircle, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ApiError } from "../../api/client";
import { documentsApi, type CompanyDocument } from "../../api/documents";
import { issuesApi } from "../../api/issues";
import { softwareFactoryApi } from "../../api/software-factory";
import { vaultApi } from "../../api/vault";
import { queryKeys } from "../../lib/queryKeys";
import { hypoworkCanvasNodeTypes } from "./CompanyCanvasBoard";
import { HypoworkCanvasToolbar } from "./HypoworkCanvasToolbar";
import { CANVAS_SAVE_DEBOUNCE_MS } from "./canvas-constants";
import { CanvasAiAssistant } from "./CanvasAiAssistant";
import { buildCanvasNeighborContext } from "./canvasChatContext";
import { CanvasChromeContext } from "./canvas-chrome-context";
import {
  type DocPageCanvasData,
  normalizeDocumentCanvasNodes,
} from "./normalizeDocumentCanvasNodes";
import { embedProseMarkdownInCanvasGraph } from "@paperclipai/shared";
import {
  EMPTY_CANVAS_BODY,
  extractPrimaryDocPageMarkdown,
  parseCanvasBody,
  serializeCanvasGraph,
  stripPrimaryMarkdownFromCanvasGraph,
} from "../../lib/canvasGraph";
import "./canvas.css";

function shouldRestoreServerViewport(v: { panX: number; panY: number; zoom: number }) {
  return v.zoom !== 100 || v.panX !== 0 || v.panY !== 0;
}

function parseCanvasGraphBootstrap(
  canvasGraphFromServer: string,
  proseBodyFromServer: string,
  documentId: string,
  docTitleFromServer: string | null,
) {
  let graphJson = canvasGraphFromServer?.trim() ? canvasGraphFromServer : EMPTY_CANVAS_BODY;
  let boot = parseCanvasBody(graphJson);
  if (boot.nodes.length === 0 && proseBodyFromServer.trim()) {
    boot = parseCanvasBody(
      embedProseMarkdownInCanvasGraph(proseBodyFromServer, documentId, docTitleFromServer),
    );
  }
  return boot;
}

export type DocumentCanvasEditorHandle = {
  /** Clears debounce and PATCHes immediately if there are unsaved graph/title changes vs server props. */
  flushSave: () => Promise<void>;
  /** Current graph JSON (for copy-to-clipboard before server has caught up). */
  getSerializedBody: () => string;
  /** Currently selected node id (for link-scoped RAG). */
  getSelectedNodeId: () => string | null;
  /** Build neighborhood context for the selected node (selected + connected + doc refs). */
  buildNodeContext: () => CanvasNodeContext | null;
};

export type CanvasNodeContext = {
  selectedNode: Node;
  neighborNodes: Node[];
  connectedDocIds: string[];
};

type DocumentCanvasEditorProps = {
  companyId: string;
  documentId: string;
  /** Title from document chrome (same as prose flow). */
  title: string;
  /** Stored React Flow graph (primary docPage bodies cleared server-side). */
  canvasGraphFromServer: string;
  /** Canonical prose (`latest_body`) — injected into the primary card for display. */
  proseBodyFromServer: string;
  /** Latest title from server; used for dirty detection vs local `title`. */
  docTitleFromServer: string | null;
  latestRevisionId: string | null;
  onApplied: (doc: CompanyDocument) => void;
  onConflict: () => void;
  onGraphDirtyChange?: (dirty: boolean) => void;
  /** Read-only/presentation mode — hides editing chrome */
  viewMode?: boolean;
  /** Called when user selects a node (for link-scoped RAG) */
  onNodeSelect?: (nodeId: string | null, context: CanvasNodeContext | null) => void;
  /** Resolve [[wikilinks]] / @ mentions to document ids — same as Page view for primary card Plate preview. */
  wikilinkMentionResolveDocumentId?: (wikilinkTitle: string) => string | null;
  /** When set, factory artifacts (requirements, blueprints, work orders) are loaded and offered in the toolbar. */
  projectId?: string | null;
};

export const DocumentCanvasEditor = forwardRef<DocumentCanvasEditorHandle, DocumentCanvasEditorProps>(
  function DocumentCanvasEditor(
    {
      companyId,
      documentId,
      title,
      canvasGraphFromServer,
      proseBodyFromServer,
      docTitleFromServer,
      latestRevisionId,
      onApplied,
      onConflict,
      onGraphDirtyChange,
      viewMode = false,
      onNodeSelect,
      wikilinkMentionResolveDocumentId,
      projectId,
    },
    ref,
  ) {
    const boot = parseCanvasGraphBootstrap(
      canvasGraphFromServer,
      proseBodyFromServer,
      documentId,
      docTitleFromServer,
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(
      normalizeDocumentCanvasNodes(boot.nodes, documentId, docTitleFromServer, proseBodyFromServer),
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState(boot.edges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [snapToGrid, setSnapToGrid] = useState(false);
    /** Minimap hidden until user pans/zooms or drags a node; auto-hides after idle. */
    const [showMinimap, setShowMinimap] = useState(false);
    const minimapHideTimerRef = useRef<number | null>(null);
    /** Ignore viewport events until after initial fit / restore (avoids flashing minimap on load). */
    const minimapInteractionGateRef = useRef(0);

    useEffect(() => {
      minimapInteractionGateRef.current = Date.now() + 1200;
    }, [documentId]);

    const clearMinimapHideTimer = useCallback(() => {
      if (minimapHideTimerRef.current) {
        window.clearTimeout(minimapHideTimerRef.current);
        minimapHideTimerRef.current = null;
      }
    }, []);

    const revealMinimap = useCallback(() => {
      if (Date.now() < minimapInteractionGateRef.current) return;
      clearMinimapHideTimer();
      setShowMinimap(true);
    }, [clearMinimapHideTimer]);

    const scheduleHideMinimap = useCallback(() => {
      clearMinimapHideTimer();
      minimapHideTimerRef.current = window.setTimeout(() => {
        minimapHideTimerRef.current = null;
        setShowMinimap(false);
      }, 2200);
    }, [clearMinimapHideTimer]);

    useEffect(
      () => () => {
        clearMinimapHideTimer();
      },
      [clearMinimapHideTimer],
    );

    const lastServerCanvasRef = useRef(canvasGraphFromServer);
    const lastServerProseRef = useRef(proseBodyFromServer);
    useEffect(() => {
      if (
        lastServerCanvasRef.current === canvasGraphFromServer &&
        lastServerProseRef.current === proseBodyFromServer
      ) {
        return;
      }
      lastServerCanvasRef.current = canvasGraphFromServer;
      lastServerProseRef.current = proseBodyFromServer;
      const p = parseCanvasGraphBootstrap(
        canvasGraphFromServer,
        proseBodyFromServer,
        documentId,
        docTitleFromServer,
      );
      setNodes(normalizeDocumentCanvasNodes(p.nodes, documentId, docTitleFromServer, proseBodyFromServer));
      setEdges(p.edges);
    }, [
      canvasGraphFromServer,
      proseBodyFromServer,
      documentId,
      docTitleFromServer,
      setNodes,
      setEdges,
    ]);

    useEffect(() => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== "docPage") return n;
          const d = n.data as DocPageCanvasData;
          if (!d.isPrimaryDocument || d.documentId !== documentId) return n;
          const nextTitle = docTitleFromServer?.trim() || "Untitled";
          if (d.title === nextTitle) return n;
          return { ...n, data: { ...d, title: nextTitle } };
        }),
      );
    }, [docTitleFromServer, documentId, setNodes]);

    const revisionRef = useRef(latestRevisionId);
    revisionRef.current = latestRevisionId;

    const rfRef = useRef<ReactFlowInstance | null>(null);
    const viewportAppliedRef = useRef(false);
    const viewportSaveTimerRef = useRef<number | null>(null);
    /** Next `onMoveEnd` comes from initial setViewport/fitView — skip minimap flash only. */
    const skipMinimapFromProgrammaticViewportRef = useRef(false);

    const { data: viewportRow, isFetched: viewportFetched } = useQuery({
      queryKey: queryKeys.companyDocuments.canvasViewport(companyId, documentId),
      queryFn: () => documentsApi.getCanvasViewport(companyId, documentId),
      enabled: !!companyId && !!documentId,
    });

    useEffect(() => {
      viewportAppliedRef.current = false;
    }, [documentId]);

    useEffect(() => {
      const inst = rfRef.current;
      if (!inst || !viewportFetched || viewportAppliedRef.current) return;
      viewportAppliedRef.current = true;
      skipMinimapFromProgrammaticViewportRef.current = true;
      if (viewportRow && shouldRestoreServerViewport(viewportRow)) {
        inst.setViewport({ x: viewportRow.panX, y: viewportRow.panY, zoom: viewportRow.zoom / 100 });
      } else {
        inst.fitView({ padding: 0.15 });
      }
    }, [viewportFetched, viewportRow]);

    const scheduleViewportSave = useCallback((vp: { x: number; y: number; zoom: number }) => {
      if (viewportSaveTimerRef.current) window.clearTimeout(viewportSaveTimerRef.current);
      viewportSaveTimerRef.current = window.setTimeout(() => {
        viewportSaveTimerRef.current = null;
        void documentsApi
          .patchCanvasViewport(companyId, documentId, {
            panX: Math.round(vp.x),
            panY: Math.round(vp.y),
            zoom: Math.max(15, Math.min(400, Math.round(vp.zoom * 100))),
          })
          .catch(() => {});
      }, 500);
    }, [companyId, documentId]);

    const handleViewportMoveEnd = useCallback(
      (_: unknown, v: Viewport) => {
        scheduleViewportSave(v);
        if (skipMinimapFromProgrammaticViewportRef.current) {
          skipMinimapFromProgrammaticViewportRef.current = false;
          return;
        }
        revealMinimap();
        scheduleHideMinimap();
      },
      [scheduleViewportSave, scheduleHideMinimap, revealMinimap],
    );

    useEffect(() => {
      return () => {
        if (viewportSaveTimerRef.current) window.clearTimeout(viewportSaveTimerRef.current);
      };
    }, []);

    const { data: docs } = useQuery({
      queryKey: queryKeys.companyDocuments.list(companyId),
      queryFn: () => documentsApi.list(companyId),
    });

    const { data: issues } = useQuery({
      queryKey: queryKeys.issues.list(companyId),
      queryFn: () => issuesApi.list(companyId),
    });

    const { data: requirements } = useQuery({
      queryKey: ["sf-requirements", companyId, projectId ?? "__none__"],
      queryFn: () => softwareFactoryApi.listRequirements(companyId, projectId!),
      enabled: Boolean(projectId),
    });

    const { data: blueprints } = useQuery({
      queryKey: ["sf-blueprints", companyId, projectId ?? "__none__"],
      queryFn: () => softwareFactoryApi.listBlueprints(companyId, projectId!),
      enabled: Boolean(projectId),
    });

    const { data: workOrders } = useQuery({
      queryKey: ["sf-workorders", companyId, projectId ?? "__none__"],
      queryFn: () => softwareFactoryApi.listWorkOrders(companyId, projectId!),
      enabled: Boolean(projectId),
    });

    const buildNodeContext = useCallback((): CanvasNodeContext | null => {
      const ctx = buildCanvasNeighborContext(nodes, edges, selectedNodeId);
      if (!ctx) return null;
      return {
        selectedNode: ctx.selectedNode,
        neighborNodes: ctx.neighborNodes,
        connectedDocIds: ctx.connectedDocIds,
      };
    }, [selectedNodeId, nodes, edges]);

    /** Track selection locally only — do not call `onNodeSelect` here: parent may navigate to chat. */
    const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
      const id = selected.length === 1 ? selected[0].id : null;
      setSelectedNodeId(id);
    }, []);

    /** Browser timer id (`window.setTimeout`); avoid `NodeJS.Timeout` vs `number` merge issues. */
    const saveTimerRef = useRef<number | null>(null);

    const isDirtyVsServer = useCallback(() => {
      const serialized = serializeCanvasGraph(nodes, edges);
      const stripped = stripPrimaryMarkdownFromCanvasGraph(serialized, documentId);
      const prose = extractPrimaryDocPageMarkdown(serialized, documentId);
      const serverCanvas = canvasGraphFromServer?.trim() ? canvasGraphFromServer : EMPTY_CANVAS_BODY;
      const sameGraph = stripped === serverCanvas;
      const sameProse = prose === (proseBodyFromServer ?? "");
      const sameTitle = title.trim() === (docTitleFromServer ?? "").trim();
      return !sameGraph || !sameProse || !sameTitle;
    }, [nodes, edges, title, canvasGraphFromServer, proseBodyFromServer, docTitleFromServer, documentId]);

    useEffect(() => {
      onGraphDirtyChange?.(isDirtyVsServer());
    }, [isDirtyVsServer, onGraphDirtyChange]);

    const performSave = useCallback(async () => {
      let rid = revisionRef.current;
      if (!rid) return;
      if (!isDirtyVsServer()) return;
      const serialized = serializeCanvasGraph(nodes, edges);
      const extracted = extractPrimaryDocPageMarkdown(serialized, documentId);
      const serverProse = proseBodyFromServer ?? "";
      /** Graph had no injectable primary (all refs `isPrimaryDocument: false`) — never PATCH empty prose over server SSOT. */
      const body =
        extracted.trim().length === 0 && serverProse.trim().length > 0 ? serverProse : extracted;
      const canvasGraph = stripPrimaryMarkdownFromCanvasGraph(serialized, documentId);
      const patch = () =>
        documentsApi.update(companyId, documentId, {
          title: title.trim() || null,
          format: "markdown",
          body,
          canvasGraph,
          baseRevisionId: rid,
        });
      try {
        const next = await patch();
        onApplied(next);
        /** Sync canvas topology to Vault so agents and chat can see the graph structure. */
        vaultApi.syncCanvasTopology(companyId, documentId, serialized).catch(() => {});
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 409) throw e;
        /** Revision moved (e.g. lifecycle merge elsewhere); refetch once and retry — still 409 → surface conflict. */
        const fresh = await documentsApi.get(companyId, documentId);
        const nextRid = fresh.latestRevisionId;
        if (!nextRid) {
          onConflict();
          return;
        }
        rid = nextRid;
        revisionRef.current = nextRid;
        try {
          const next = await patch();
          onApplied(next);
          vaultApi.syncCanvasTopology(companyId, documentId, serialized).catch(() => {});
        } catch (e2) {
          if (e2 instanceof ApiError && e2.status === 409) {
            onConflict();
            return;
          }
          throw e2;
        }
      }
    }, [
      companyId,
      documentId,
      title,
      nodes,
      edges,
      isDirtyVsServer,
      onApplied,
      onConflict,
      proseBodyFromServer,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        flushSave: async () => {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          await performSave();
        },
        getSerializedBody: () => serializeCanvasGraph(nodes, edges),
        getSelectedNodeId: () => selectedNodeId,
        buildNodeContext,
      }),
      [performSave, nodes, edges, selectedNodeId, buildNodeContext],
    );

    useEffect(() => {
      if (!latestRevisionId) return;
      if (!isDirtyVsServer()) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void performSave();
      }, CANVAS_SAVE_DEBOUNCE_MS);

      return () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [
      nodes,
      edges,
      title,
      canvasGraphFromServer,
      proseBodyFromServer,
      docTitleFromServer,
      latestRevisionId,
      isDirtyVsServer,
      performSave,
    ]);

    const onConnect = useCallback(
      (params: Connection) => {
        setEdges((eds) => addEdge({ ...params, type: "smoothstep", animated: true }, eds));
      },
      [setEdges],
    );

    const clearBoard = useCallback(() => {
      if (!confirm("Remove all nodes and edges from this canvas?")) return;
      setNodes([]);
      setEdges([]);
    }, [setNodes, setEdges]);

    return (
      <CanvasChromeContext.Provider
        value={{
          viewMode,
          hostDocumentId: documentId,
          wikilinkMentionResolveDocumentId,
          projectWorkOrders: projectId ? workOrders : undefined,
        }}
      >
        <div className="flex h-[min(85vh,calc(100vh-10rem))] min-h-[420px] w-full flex-col rounded-lg border border-border bg-muted/20">
          <div className="relative min-h-0 flex-1">
            <ReactFlow
              onInit={(inst) => {
                rfRef.current = inst;
              }}
              onMoveStart={revealMinimap}
              onMoveEnd={handleViewportMoveEnd}
              onNodeDragStart={revealMinimap}
              onNodeDragStop={scheduleHideMinimap}
              nodes={nodes}
              edges={edges}
              onNodesChange={viewMode ? undefined : onNodesChange}
              onEdgesChange={viewMode ? undefined : onEdgesChange}
              onConnect={viewMode ? undefined : onConnect}
              onSelectionChange={handleSelectionChange}
              nodeTypes={hypoworkCanvasNodeTypes}
              snapToGrid={snapToGrid && !viewMode}
              snapGrid={[24, 24]}
              minZoom={0.15}
              maxZoom={1.5}
              panOnDrag={viewMode ? false : true}
              nodesDraggable={!viewMode}
              nodesConnectable={!viewMode}
              elementsSelectable={true}
              proOptions={{ hideAttribution: true }}
              className="canvas-dot-grid"
            >
              {!viewMode && (
                <HypoworkCanvasToolbar
                  setNodes={setNodes}
                  setEdges={setEdges}
                  docs={docs}
                  issues={issues}
                  requirements={requirements}
                  blueprints={blueprints}
                  workOrders={workOrders}
                  onClear={clearBoard}
                  toolbarTitle="Canvas document"
                  toolbarHint="Autosaves to this note · pan/zoom · connect handles"
                  snapToGrid={snapToGrid}
                  onToggleSnapToGrid={() => setSnapToGrid((s) => !s)}
                  hideTopToolbar
                />
              )}

              <CanvasAiAssistant
                companyId={companyId}
                documentId={documentId}
                documentTitle={docTitleFromServer}
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNodeId}
              />

              <Panel position="top-right" className="m-2 flex max-w-[min(100vw-1rem,20rem)] flex-col items-end gap-2">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="nodrag flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card/95 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="About canvas storage"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-balance text-left leading-snug">
                      Canvas graph and prose are stored separately (split SSOT). Phase 1 upgrades this toward a
                      Hypopedia-style infinite canvas.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {viewMode ? (
                  <div className="rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
                    Presentation mode — pan only; expand the assistant for in-canvas chat or open full Chat
                  </div>
                ) : null}
              </Panel>

              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls
                showInteractive={false}
                className={cn(
                  "overflow-hidden rounded-lg border border-border/70 bg-card/85 text-foreground shadow-md backdrop-blur-md dark:border-border/50 dark:bg-card/75",
                  "[&_.react-flow__controls-button]:border-border/60 [&_.react-flow__controls-button]:bg-background [&_.react-flow__controls-button]:text-foreground",
                  "[&_.react-flow__controls-button:hover]:bg-muted [&_.react-flow__controls-button]:border-border",
                  "[&_.react-flow__controls-button]:fill-foreground [&_svg]:text-foreground",
                )}
              />
              <MiniMap
                zoomable
                pannable
                style={{ width: 112, height: 84 }}
                aria-hidden={!showMinimap}
                className={cn(
                  "!border border-border/50 !bg-transparent shadow-sm backdrop-blur-sm transition-opacity duration-300 dark:border-border/40",
                  showMinimap ? "opacity-95" : "pointer-events-none opacity-0",
                )}
                maskColor="hsl(var(--background) / 0.45)"
                maskStrokeColor="hsl(var(--border) / 0.6)"
                nodeColor={() => "hsl(var(--primary) / 0.42)"}
                nodeStrokeColor="hsl(var(--border))"
                nodeStrokeWidth={1}
              />

              {selectedNodeId && !viewMode && (
                <Panel position="bottom-center" className="mb-2">
                  <button
                    type="button"
                    onClick={() => onNodeSelect?.(selectedNodeId, buildNodeContext())}
                    className="flex items-center gap-1.5 rounded-full border border-primary bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ask about this
                  </button>
                </Panel>
              )}

            </ReactFlow>
          </div>
        </div>
      </CanvasChromeContext.Provider>
    );
  },
);

DocumentCanvasEditor.displayName = "DocumentCanvasEditor";
