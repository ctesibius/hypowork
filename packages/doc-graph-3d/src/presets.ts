import type { ForceGraph3DInstance, NodeObject } from "3d-force-graph";

/** Preset ids mirror `3d-force-graph` examples under `example/` (see repo `3d-force-graph-master`). */
export const DOC_GRAPH_VIEW_PRESETS = [
  { id: "minimal", label: "Minimal (basic)", example: "example/basic" },
  { id: "directionalParticles", label: "Directional particles", example: "example/directional-links-particles" },
  { id: "directionalArrows", label: "Directional arrows + curvature", example: "example/directional-links-arrows" },
  { id: "curvedParticles", label: "Curved links + particles", example: "example/curved-links" },
  { id: "kindColors", label: "Auto color by doc kind", example: "example/auto-colored (by kind)" },
  { id: "highlight", label: "Highlight on hover (neighbors)", example: "example/highlight" },
] as const;

export type DocGraphViewPresetId = (typeof DOC_GRAPH_VIEW_PRESETS)[number]["id"];

type GraphNode = NodeObject & { title?: string; kind?: string };

function applyNodeTitleLabels(graph: ForceGraph3DInstance): void {
  graph.nodeLabel((n: NodeObject) => {
    const gn = n as GraphNode;
    const id = String(gn.id ?? "");
    return gn.title ?? id.slice(0, 8);
  });
}

/** Visual preset only — not for `highlight` (that uses `setupDocGraphHighlightInteraction`). */
export function applyDocGraphViewPreset(
  graph: ForceGraph3DInstance,
  preset: Exclude<DocGraphViewPresetId, "highlight">,
  ctx: { isDark: boolean },
): void {
  const bg = ctx.isDark ? "#0c0c0f" : "#f4f4f5";
  const prose = ctx.isDark ? "#5dade2" : "#0984e3";
  const canvas = ctx.isDark ? "#f9e79f" : "#d4ac0d";

  graph
    .backgroundColor(bg)
    .showNavInfo(false)
    .linkDirectionalParticles(0)
    .linkDirectionalParticleSpeed(0)
    .linkDirectionalArrowLength(0)
    .linkCurvature(0)
    .linkCurveRotation(0)
    .linkWidth(0.55)
    .linkOpacity(0.42);

  applyNodeTitleLabels(graph);

  switch (preset) {
    case "minimal":
      graph.nodeColor(() => (ctx.isDark ? "#8ab4f8" : "#1a73e8")).linkOpacity(0.5);
      break;
    case "directionalParticles":
      graph
        .nodeColor(() => (ctx.isDark ? "#7ec8e3" : "#2471a3"))
        .linkDirectionalParticles(2)
        .linkDirectionalParticleSpeed(0.004)
        .linkDirectionalParticleWidth(0.75);
      break;
    case "directionalArrows":
      graph
        .nodeColor(() => (ctx.isDark ? "#82e0aa" : "#1e8449"))
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .linkCurvature(0.25);
      break;
    case "curvedParticles":
      graph
        .nodeColor(() => (ctx.isDark ? "#d7bde2" : "#7d3c98"))
        .linkCurvature(0.2)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleSpeed(0.003)
        .linkDirectionalParticleWidth(0.65);
      break;
    case "kindColors":
      graph
        .nodeColor((n: NodeObject) => ((n as GraphNode).kind === "canvas" ? canvas : prose))
        .linkOpacity(0.38)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.002);
      break;
    default:
      break;
  }
}

/** Background + dim defaults before attaching highlight interaction. */
export function applyDocGraphHighlightChrome(graph: ForceGraph3DInstance, ctx: { isDark: boolean }): void {
  const bg = ctx.isDark ? "#0c0c0f" : "#f4f4f5";
  graph.backgroundColor(bg).showNavInfo(false).linkOpacity(0.4);
}
