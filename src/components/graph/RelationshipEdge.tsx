'use client';

import { useState } from 'react';
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
  showLabel?: boolean;
  evidence: { documentId: string; filename: string; excerpt: string }[];
};

type RelationshipEdge = Edge<RelationshipEdgeData, 'relationship'>;

const EDGE_COLORS: Record<string, string> = {
  supports: '#4ade80',
  contradicts: '#f87171',
  extends: '#60a5fa',
  similar: '#c084fc',
  example_of: '#fb923c',
  depends_on: '#2dd4bf',
};

const DEFAULT_COLOR = '#555555';

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
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = EDGE_COLORS[data?.relType ?? ''] ?? DEFAULT_COLOR;
  const label = formatLabel(data?.relType);
  const showLabel = hovered || data?.showLabel;

  return (
    <>
      {/* Invisible wider hit area for hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: color,
          strokeWidth: hovered ? 2 : 1.5,
          transition: 'opacity 0.15s, stroke-width 0.15s',
        }}
      />
      {showLabel && label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="rounded-sm border border-border bg-card px-2 py-0.5 text-[10px] font-medium"
          >
            <span style={{ color }}>{label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
