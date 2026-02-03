const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;
const NODE_GAP_X = 60;
const NODE_GAP_Y = 50;
const GROUP_PADDING = 50;
const GROUP_HEADER = 56;
const GROUP_GAP = 180;

type LayoutNode = { id: string; documentId?: string };
type LayoutEdge = { source: string; target: string };

export type GroupBox = {
  documentId: string;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Document-grouped layout.
 *
 * Nodes are arranged in a grid within their document group rectangle.
 * Groups are placed side by side. Cross-document edges still connect.
 */
export function computeLayout(
  nodes: LayoutNode[],
  _edges: LayoutEdge[],
): { positions: Map<string, { x: number; y: number }>; groups: GroupBox[] } {
  const positions = new Map<string, { x: number; y: number }>();
  const groups: GroupBox[] = [];

  if (nodes.length === 0) return { positions, groups };

  // Group nodes by document
  const docGroups = new Map<string, { filename: string; nodes: LayoutNode[] }>();
  const ungrouped: LayoutNode[] = [];

  for (const node of nodes) {
    if (node.documentId) {
      if (!docGroups.has(node.documentId)) {
        docGroups.set(node.documentId, {
          filename: node.documentId, // will be overwritten with real filename
          nodes: [],
        });
      }
      docGroups.get(node.documentId)!.nodes.push(node);
    } else {
      ungrouped.push(node);
    }
  }

  // Determine columns per group — aim for roughly 3-4 columns
  function layoutGroup(groupNodes: LayoutNode[], offsetX: number, offsetY: number) {
    const n = groupNodes.length;
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n))));
    const rows = Math.ceil(n / cols);

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(groupNodes[i].id, {
        x: offsetX + GROUP_PADDING + col * (NODE_WIDTH + NODE_GAP_X),
        y: offsetY + GROUP_HEADER + GROUP_PADDING + row * (NODE_HEIGHT + NODE_GAP_Y),
      });
    }

    const actualCols = Math.min(cols, n);
    const width = GROUP_PADDING * 2 + actualCols * NODE_WIDTH + (actualCols - 1) * NODE_GAP_X;
    const height = GROUP_HEADER + GROUP_PADDING * 2 + rows * NODE_HEIGHT + (rows - 1) * NODE_GAP_Y;
    return { width, height };
  }

  let cursorX = 0;
  const sortedGroups = [...docGroups.entries()].sort(
    (a, b) => b[1].nodes.length - a[1].nodes.length,
  );

  for (const [docId, group] of sortedGroups) {
    const { width, height } = layoutGroup(group.nodes, cursorX, 0);
    groups.push({
      documentId: docId,
      filename: group.filename,
      x: cursorX,
      y: 0,
      width,
      height,
    });
    cursorX += width + GROUP_GAP;
  }

  // Ungrouped nodes go in their own section
  if (ungrouped.length > 0) {
    const { width, height } = layoutGroup(ungrouped, cursorX, 0);
    groups.push({
      documentId: '__ungrouped',
      filename: 'Other',
      x: cursorX,
      y: 0,
      width,
      height,
    });
    cursorX += width + GROUP_GAP;
  }

  // Center everything
  const totalWidth = cursorX - GROUP_GAP;
  const offsetX = -totalWidth / 2;
  const maxH = Math.max(...groups.map((g) => g.height), 0);
  const offsetY = -maxH / 2;

  for (const pos of positions.values()) {
    pos.x += offsetX;
    pos.y += offsetY;
  }
  for (const g of groups) {
    g.x += offsetX;
    g.y += offsetY;
  }

  return { positions, groups };
}
