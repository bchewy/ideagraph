const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const NODE_SEP = 60;
const RANK_SEP = 80;

type LayoutNode = { id: string };
type LayoutEdge = { source: string; target: string };

export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const nodeIds = new Set(nodes.map((n) => n.id));
  const children = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    children.set(id, []);
    inDegree.set(id, 0);
  }

  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      children.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
  }

  const rank = new Map<string, number>();
  const queue: string[] = [];

  for (const id of nodeIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      queue.push(id);
      rank.set(id, 0);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const r = rank.get(id)!;
    for (const child of children.get(id) ?? []) {
      const prev = rank.get(child);
      const next = r + 1;
      if (prev === undefined || next > prev) {
        rank.set(child, next);
      }
      const remaining = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, remaining);
      if (remaining === 0) {
        queue.push(child);
      }
    }
  }

  for (const id of nodeIds) {
    if (!rank.has(id)) rank.set(id, 0);
  }

  const ranks = new Map<number, string[]>();
  for (const [id, r] of rank) {
    if (!ranks.has(r)) ranks.set(r, []);
    ranks.get(r)!.push(id);
  }

  const sortedRanks = [...ranks.keys()].sort((a, b) => a - b);

  for (const r of sortedRanks) {
    const layer = ranks.get(r)!;
    const totalWidth = layer.length * NODE_WIDTH + (layer.length - 1) * NODE_SEP;
    const startX = -totalWidth / 2;
    const y = r * (NODE_HEIGHT + RANK_SEP);

    for (let i = 0; i < layer.length; i++) {
      positions.set(layer[i], {
        x: startX + i * (NODE_WIDTH + NODE_SEP),
        y,
      });
    }
  }

  return positions;
}
