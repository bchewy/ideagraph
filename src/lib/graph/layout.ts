import dagre from '@dagrejs/dagre';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

type LayoutNode = { id: string };
type LayoutEdge = { source: string; target: string };

export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    positions.set(node.id, {
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
    });
  }
  return positions;
}
