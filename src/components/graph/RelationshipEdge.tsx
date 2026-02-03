'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';

type RelationshipEdgeData = {
  relType: string;
  confidence: number;
  evidence: { documentId: string; filename: string; excerpt: string }[];
};

type RelationshipEdge = Edge<RelationshipEdgeData, 'relationship'>;

const EDGE_COLORS: Record<string, string> = {
  supports: '#22c55e',
  contradicts: '#ef4444',
  extends: '#3b82f6',
  similar: '#a855f7',
  example_of: '#f97316',
  depends_on: '#14b8a6',
};

const DEFAULT_EDGE_COLOR = '#6b7280';

function getEdgeColor(relType: string | undefined): string {
  if (!relType) return DEFAULT_EDGE_COLOR;
  return EDGE_COLORS[relType] ?? DEFAULT_EDGE_COLOR;
}

function formatLabel(relType: string | undefined): string {
  if (!relType) return '';
  return relType.replace(/_/g, ' ');
}

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<RelationshipEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = getEdgeColor(data?.relType);
  const label = formatLabel(data?.relType);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: color, strokeWidth: 2 }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan rounded-full border bg-background px-2 py-0.5 text-xs font-medium"
          >
            <span style={{ color }}>{label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
