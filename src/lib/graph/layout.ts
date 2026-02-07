const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;
const NODE_GAP_X = 60;
const NODE_GAP_Y = 40;
const GROUP_PADDING = 50;
const GROUP_HEADER = 56;
const GROUP_SUMMARY = 120;
const GROUP_GAP_X = 180;
const GROUP_GAP_Y = 180;

type LayoutNode = { id: string; documentId?: string };
type LayoutEdge = { source: string; target: string };

export type GroupBox = {
  documentId: string;
  filename: string;
  summary?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Document-grouped layout.
 *
 * Nodes are arranged in a grid within their document group rectangle.
 * Groups are packed into a compact multi-row grid (rather than a single strip),
 * so projects with many PDFs remain readable. Cross-document edges still connect.
 */
export function computeLayout(
  nodes: LayoutNode[],
  _edges: LayoutEdge[],
  summaries?: Map<string, string>,
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

  function measureGroup(n: number, hasSummary: boolean) {
    // Determine columns per group — aim for roughly 2-3 columns
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n))));
    const rows = Math.ceil(n / cols);
    const headerHeight = GROUP_HEADER + (hasSummary ? GROUP_SUMMARY : 0);
    const actualCols = Math.min(cols, n);

    const width = GROUP_PADDING * 2 + actualCols * NODE_WIDTH + (actualCols - 1) * NODE_GAP_X;
    const height = headerHeight + GROUP_PADDING * 2 + rows * NODE_HEIGHT + (rows - 1) * NODE_GAP_Y;
    return { cols, rows, headerHeight, actualCols, width, height };
  }

  function layoutGroup(
    groupNodes: LayoutNode[],
    offsetX: number,
    offsetY: number,
    hasSummary: boolean,
    cols: number,
    headerHeight: number,
  ) {
    const n = groupNodes.length;
    // `rows` is only needed for measurement, positions are computed by index below.

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(groupNodes[i].id, {
        x: offsetX + GROUP_PADDING + col * (NODE_WIDTH + NODE_GAP_X),
        y: offsetY + headerHeight + GROUP_PADDING + row * (NODE_HEIGHT + NODE_GAP_Y),
      });
    }
  }

  const sortedGroups = [...docGroups.entries()].sort(
    (a, b) => b[1].nodes.length - a[1].nodes.length,
  );

  const plannedGroups: Array<
    Omit<GroupBox, 'x' | 'y'> & { nodes: LayoutNode[]; cols: number; headerHeight: number }
  > = [];

  for (const [docId, group] of sortedGroups) {
    const summary = summaries?.get(docId);
    const m = measureGroup(group.nodes.length, !!summary);
    plannedGroups.push({
      documentId: docId,
      filename: group.filename,
      summary,
      width: m.width,
      height: m.height,
      nodes: group.nodes,
      cols: m.cols,
      headerHeight: m.headerHeight,
    });
  }

  // Ungrouped nodes go in their own section
  if (ungrouped.length > 0) {
    const m = measureGroup(ungrouped.length, false);
    plannedGroups.push({
      documentId: '__ungrouped',
      filename: 'Other',
      width: m.width,
      height: m.height,
      nodes: ungrouped,
      cols: m.cols,
      headerHeight: m.headerHeight,
    });
  }

  if (plannedGroups.length === 0) return { positions, groups };

  // Pack document groups into a multi-row grid.
  // Heuristic: keep tiny projects in a single row; otherwise aim for a square-ish grid.
  const nGroups = plannedGroups.length;
  const gridCols =
    nGroups <= 3 ? nGroups : Math.min(6, Math.max(2, Math.ceil(Math.sqrt(nGroups))));

  const rows: typeof plannedGroups[] = [];
  for (let i = 0; i < plannedGroups.length; i += gridCols) {
    rows.push(plannedGroups.slice(i, i + gridCols));
  }

  const rowHeights = rows.map((row) => Math.max(...row.map((g) => g.height), 0));
  const rowWidths = rows.map((row) => {
    if (row.length === 0) return 0;
    const content = row.reduce((sum, g) => sum + g.width, 0);
    return content + (row.length - 1) * GROUP_GAP_X;
  });
  const maxRowWidth = Math.max(...rowWidths, 0);

  let y = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowWidth = rowWidths[r] ?? 0;
    let x = Math.round((maxRowWidth - rowWidth) / 2);

    for (const pg of row) {
      layoutGroup(pg.nodes, x, y, !!pg.summary, pg.cols, pg.headerHeight);
      groups.push({
        documentId: pg.documentId,
        filename: pg.filename,
        summary: pg.summary,
        x,
        y,
        width: pg.width,
        height: pg.height,
      });
      x += pg.width + GROUP_GAP_X;
    }

    y += rowHeights[r] + (r === rows.length - 1 ? 0 : GROUP_GAP_Y);
  }

  // Center everything around the origin.
  const minX = Math.min(...groups.map((g) => g.x), 0);
  const minY = Math.min(...groups.map((g) => g.y), 0);
  const maxX = Math.max(...groups.map((g) => g.x + g.width), 0);
  const maxY = Math.max(...groups.map((g) => g.y + g.height), 0);
  const offsetX = -(minX + maxX) / 2;
  const offsetY = -(minY + maxY) / 2;

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
