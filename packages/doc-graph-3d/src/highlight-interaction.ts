import type { ForceGraph3DInstance, LinkObject, NodeObject } from "3d-force-graph";
import { getDocGraphThemePalette, type DocGraphAppTheme } from "./theme-palette.js";

type AugNode = NodeObject & {
  title?: string;
  neighbors?: NodeObject[];
  links?: LinkObject<NodeObject>[];
};

/**
 * Match `example/highlight/index.html` — hover node/link to emphasize neighborhood.
 * Call only after `graph.graphData(augmentDocGraphForHighlight(...))`.
 */
export function setupDocGraphHighlightInteraction(
  graph: ForceGraph3DInstance,
  opts: { theme: DocGraphAppTheme },
): void {
  const palette = getDocGraphThemePalette(opts.theme);
  const highlightNodes = new Set<unknown>();
  const highlightLinks = new Set<unknown>();
  let hoverNode: unknown = null;

  const dim = palette.highlightDim;
  const hot = "rgb(220,70,70)";
  const warm = opts.theme === "mid" ? "rgba(180,100,40,0.95)" : "rgba(255,180,60,0.9)";

  graph
    .nodeLabel((n: NodeObject) => {
      const gn = n as AugNode;
      const id = String(gn.id ?? "");
      return gn.title ?? id.slice(0, 8);
    })
    .nodeColor((node: NodeObject) => {
      if (!highlightNodes.size) return dim;
      return highlightNodes.has(node) ? (node === hoverNode ? hot : warm) : dim;
    })
    .linkWidth((link: unknown) => (highlightLinks.has(link) ? 3.5 : 0.55))
    .linkDirectionalParticles((link: unknown) => (highlightLinks.has(link) ? 4 : 0))
    .linkDirectionalParticleWidth(3)
    .onNodeHover((node: NodeObject | null) => {
      if ((!node && highlightNodes.size === 0) || (node && hoverNode === node)) return;

      highlightNodes.clear();
      highlightLinks.clear();
      if (node) {
        const gn = node as AugNode;
        highlightNodes.add(node);
        gn.neighbors?.forEach((neighbor: NodeObject) => highlightNodes.add(neighbor));
        gn.links?.forEach((link: LinkObject<NodeObject>) => highlightLinks.add(link));
      }

      hoverNode = node ?? null;

      graph.nodeColor(graph.nodeColor()).linkWidth(graph.linkWidth()).linkDirectionalParticles(graph.linkDirectionalParticles());
    })
    .onLinkHover((link: LinkObject<NodeObject> | null) => {
      highlightNodes.clear();
      highlightLinks.clear();

      if (link) {
        highlightLinks.add(link);
        if (link.source != null) highlightNodes.add(link.source as NodeObject);
        if (link.target != null) highlightNodes.add(link.target as NodeObject);
      }

      graph.nodeColor(graph.nodeColor()).linkWidth(graph.linkWidth()).linkDirectionalParticles(graph.linkDirectionalParticles());
    });
}
