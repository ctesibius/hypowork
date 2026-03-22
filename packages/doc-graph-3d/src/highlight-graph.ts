/** Node shape after augmentation for `highlight` preset (3d-force-graph `example/highlight`). */

export type DocGraphNodeInput = { id: string; title: string; kind?: string };

export type DocGraphLinkInput = {
  source: string;
  target: string;
  rawReference?: string;
  linkKind?: string;
};

export type DocGraphNodeHighlight = DocGraphNodeInput & {
  neighbors: DocGraphNodeHighlight[];
  links: DocGraphLinkInput[];
};

/**
 * Cross-link node objects with `neighbors` / `links` like the upstream highlight demo
 * so hover can highlight the 1-hop neighborhood.
 */
export function augmentDocGraphForHighlight(data: {
  nodes: DocGraphNodeInput[];
  links: DocGraphLinkInput[];
}): { nodes: DocGraphNodeHighlight[]; links: DocGraphLinkInput[] } {
  const nodes = data.nodes.map((n) => ({ ...n, neighbors: [] as DocGraphNodeHighlight[], links: [] as DocGraphLinkInput[] }));
  const idToNode = new Map(nodes.map((n) => [n.id, n]));

  for (const link of data.links) {
    const a = idToNode.get(link.source);
    const b = idToNode.get(link.target);
    if (!a || !b) continue;
    a.neighbors.push(b);
    b.neighbors.push(a);
    a.links.push(link);
    b.links.push(link);
  }

  return { nodes, links: data.links };
}
