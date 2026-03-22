import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ApiError } from "../../api/client";
import { documentsApi, type CompanyDocument } from "../../api/documents";
import { issuesApi } from "../../api/issues";
import { queryKeys } from "../../lib/queryKeys";
import { CANVAS_SAVE_DEBOUNCE_MS, HypoworkCanvasToolbar, hypoworkCanvasNodeTypes } from "./CompanyCanvasBoard";
import { parseCanvasBody, serializeCanvasGraph } from "../../lib/canvasGraph";

export type DocumentCanvasEditorHandle = {
  /** Clears debounce and PATCHes immediately if there are unsaved graph/title changes vs server props. */
  flushSave: () => Promise<void>;
  /** Current graph JSON (for copy-to-clipboard before server has caught up). */
  getSerializedBody: () => string;
};

type DocumentCanvasEditorProps = {
  companyId: string;
  documentId: string;
  /** Title from document chrome (same as prose flow). */
  title: string;
  /** Latest body from server (JSON graph). Updates after saves/refetch. */
  bodyFromServer: string;
  /** Latest title from server; used for dirty detection vs local `title`. */
  docTitleFromServer: string | null;
  latestRevisionId: string | null;
  onApplied: (doc: CompanyDocument) => void;
  onConflict: () => void;
  onGraphDirtyChange?: (dirty: boolean) => void;
};

export const DocumentCanvasEditor = forwardRef<DocumentCanvasEditorHandle, DocumentCanvasEditorProps>(
  function DocumentCanvasEditor(
    {
      companyId,
      documentId,
      title,
      bodyFromServer,
      docTitleFromServer,
      latestRevisionId,
      onApplied,
      onConflict,
      onGraphDirtyChange,
    },
    ref,
  ) {
    const initial = parseCanvasBody(bodyFromServer);
    const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

    const revisionRef = useRef(latestRevisionId);
    revisionRef.current = latestRevisionId;

    const { data: docs } = useQuery({
      queryKey: queryKeys.companyDocuments.list(companyId),
      queryFn: () => documentsApi.list(companyId),
    });

    const { data: issues } = useQuery({
      queryKey: queryKeys.issues.list(companyId),
      queryFn: () => issuesApi.list(companyId),
    });

    /** Browser timer id (`window.setTimeout`); avoid `NodeJS.Timeout` vs `number` merge issues. */
    const saveTimerRef = useRef<number | null>(null);

    const isDirtyVsServer = useCallback(() => {
      const serialized = serializeCanvasGraph(nodes, edges);
      const sameBody = serialized === (bodyFromServer ?? "");
      const sameTitle = title.trim() === (docTitleFromServer ?? "").trim();
      return !sameBody || !sameTitle;
    }, [nodes, edges, title, bodyFromServer, docTitleFromServer]);

    useEffect(() => {
      onGraphDirtyChange?.(isDirtyVsServer());
    }, [isDirtyVsServer, onGraphDirtyChange]);

    const performSave = useCallback(async () => {
      const rid = revisionRef.current;
      if (!rid) return;
      if (!isDirtyVsServer()) return;
      const serialized = serializeCanvasGraph(nodes, edges);
      try {
        const next = await documentsApi.update(companyId, documentId, {
          title: title.trim() || null,
          format: "markdown",
          body: serialized,
          baseRevisionId: rid,
        });
        onApplied(next);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          onConflict();
          return;
        }
        throw e;
      }
    }, [companyId, documentId, title, nodes, edges, isDirtyVsServer, onApplied, onConflict]);

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
      }),
      [performSave, nodes, edges],
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
    }, [nodes, edges, title, bodyFromServer, docTitleFromServer, latestRevisionId, isDirtyVsServer, performSave]);

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
      <div className="flex h-[min(85vh,calc(100vh-10rem))] min-h-[420px] w-full flex-col rounded-lg border border-border bg-muted/20">
        <div className="relative min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={hypoworkCanvasNodeTypes}
            fitView
            minZoom={0.15}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            className="bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[length:20px_20px]"
          >
            <HypoworkCanvasToolbar
              setNodes={setNodes}
              setEdges={setEdges}
              docs={docs}
              issues={issues}
              onClear={clearBoard}
              toolbarTitle="Canvas document"
              toolbarHint="Autosaves to this note · pan/zoom · connect handles"
            />
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap zoomable pannable className="!bg-card" />
            <Panel position="bottom-left" className="m-2 max-w-sm rounded-md border border-border bg-card/95 px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm">
              Stored as JSON on the document body (MVP). Phase 1 upgrades this toward a Hypopedia-style infinite canvas.
            </Panel>
          </ReactFlow>
        </div>
      </div>
    );
  },
);

DocumentCanvasEditor.displayName = "DocumentCanvasEditor";
