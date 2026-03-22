export { default as ForceGraph3D } from "3d-force-graph";
export type { ForceGraph3DInstance } from "3d-force-graph";

export {
  DOC_GRAPH_VIEW_PRESETS,
  applyDocGraphViewPreset,
  applyDocGraphHighlightChrome,
  type DocGraphViewPresetId,
} from "./presets.js";

export { augmentDocGraphForHighlight, type DocGraphNodeHighlight, type DocGraphNodeInput, type DocGraphLinkInput } from "./highlight-graph.js";

export { setupDocGraphHighlightInteraction } from "./highlight-interaction.js";
