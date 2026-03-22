import type { ForceGraph3DInstance, NodeObject } from "3d-force-graph";
import { getDocGraphThemePalette, type DocGraphAppTheme } from "./theme-palette.js";

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
  ctx: { theme: DocGraphAppTheme },
): void {
  const c = getDocGraphThemePalette(ctx.theme);

  graph
    .backgroundColor(c.background)
    .showNavInfo(false)
    .linkDirectionalParticles(0)
    .linkDirectionalParticleSpeed(0)
    .linkDirectionalArrowLength(0)
    .linkCurvature(0)
    .linkCurveRotation(0)
    .linkWidth(0.55)
    .linkOpacity(c.defaultLinkOpacity);

  applyNodeTitleLabels(graph);

  switch (preset) {
    case "minimal":
      graph.nodeColor(() => c.minimalNode).linkOpacity(Math.min(0.55, c.defaultLinkOpacity + 0.08));
      break;
    case "directionalParticles":
      graph
        .nodeColor(() => c.particlesNode)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleSpeed(0.004)
        .linkDirectionalParticleWidth(0.75);
      break;
    case "directionalArrows":
      graph
        .nodeColor(() => c.arrowsNode)
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .linkCurvature(0.25);
      break;
    case "curvedParticles":
      graph
        .nodeColor(() => c.curvedNode)
        .linkCurvature(0.2)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleSpeed(0.003)
        .linkDirectionalParticleWidth(0.65);
      break;
    case "kindColors":
      graph
        .nodeColor((n: NodeObject) => ((n as GraphNode).kind === "canvas" ? c.canvasNode : c.proseNode))
        .linkOpacity(Math.min(0.48, c.defaultLinkOpacity + 0.06))
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.002);
      break;
    default:
      break;
  }
}

/** Background + dim defaults before attaching highlight interaction. */
export function applyDocGraphHighlightChrome(graph: ForceGraph3DInstance, ctx: { theme: DocGraphAppTheme }): void {
  const c = getDocGraphThemePalette(ctx.theme);
  graph.backgroundColor(c.background).showNavInfo(false).linkOpacity(c.defaultLinkOpacity + 0.05);
}

export type { DocGraphAppTheme };
