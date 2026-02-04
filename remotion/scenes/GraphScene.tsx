import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion';
import { fontFamily } from '../lib/fonts';
import { COLORS, EDGE_COLORS } from '../lib/constants';
import { NODES, EDGES, DOCUMENTS, type SampleNode } from '../lib/sample-data';

const GROUP_PADDING = 32;
const GROUP_HEADER = 40;
const NODE_W = 180;
const NODE_H = 80;
const NODE_GAP_X = 50;
const NODE_GAP_Y = 50;
const GROUP_GAP = 60;
const CANVAS_OFFSET_X = 30;
const CANVAS_OFFSET_Y = 100;

type Group = {
  docId: string;
  filename: string;
  nodes: SampleNode[];
  x: number;
  y: number;
  width: number;
  height: number;
};

function buildGroups(): Group[] {
  return DOCUMENTS.map((doc, gi) => {
    const docNodes = NODES.filter((n) => n.documentId === doc.id);
    const cols = 2;
    const rows = Math.ceil(docNodes.length / cols);
    const w =
      GROUP_PADDING * 2 + cols * NODE_W + (cols - 1) * NODE_GAP_X;
    const h =
      GROUP_HEADER + GROUP_PADDING + rows * NODE_H + (rows - 1) * NODE_GAP_Y + GROUP_PADDING;

    const nodesWithPos = docNodes.map((n, ni) => ({
      ...n,
      x: GROUP_PADDING + (ni % cols) * (NODE_W + NODE_GAP_X),
      y: GROUP_HEADER + GROUP_PADDING + Math.floor(ni / cols) * (NODE_H + NODE_GAP_Y),
    }));

    return {
      docId: doc.id,
      filename: doc.filename,
      nodes: nodesWithPos,
      x: CANVAS_OFFSET_X + gi * (w + GROUP_GAP),
      y: CANVAS_OFFSET_Y,
      width: w,
      height: h,
    };
  });
}

function getNodeCenter(
  groups: Group[],
  nodeId: string,
): { x: number; y: number } | null {
  for (const group of groups) {
    const node = group.nodes.find((n) => n.id === nodeId);
    if (node) {
      return {
        x: group.x + node.x + NODE_W / 2,
        y: group.y + node.y + NODE_H / 2,
      };
    }
  }
  return null;
}

export const GraphScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const groups = buildGroups();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        fontFamily,
        display: 'flex',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          borderRight: `1px solid ${COLORS.border}`,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: COLORS.textDim,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12,
          }}
        >
          Documents
        </div>
        {DOCUMENTS.map((doc, i) => {
          const docOpacity = interpolate(
            frame,
            [i * 8, i * 8 + 15],
            [0, 1],
            { extrapolateRight: 'clamp' },
          );
          return (
            <div
              key={doc.id}
              style={{
                fontSize: 12,
                color: COLORS.text,
                padding: '8px 0',
                borderBottom: `1px solid ${COLORS.border}`,
                opacity: docOpacity,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: COLORS.textMuted, fontSize: 10 }}>
                PDF
              </span>
              {doc.filename}
            </div>
          );
        })}
      </div>

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          backgroundColor: COLORS.canvas,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <DotGrid />

        {/* Edges drawing in (behind nodes) */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {EDGES.map((edge, i) => {
            const src = getNodeCenter(groups, edge.source);
            const tgt = getNodeCenter(groups, edge.target);
            if (!src || !tgt) return null;

            const edgeDelay = 80 + i * 8;
            const drawProgress = interpolate(
              frame,
              [edgeDelay, edgeDelay + 25],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );

            const color = EDGE_COLORS[edge.relType] ?? '#555';

            const dx = tgt.x - src.x;
            const cx1 = src.x + dx * 0.3;
            const cy1 = src.y;
            const cx2 = tgt.x - dx * 0.3;
            const cy2 = tgt.y;

            const pathD = `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgt.x} ${tgt.y}`;
            const pathLength = 1000;

            return (
              <path
                key={edge.id}
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={pathLength}
                strokeDashoffset={pathLength * (1 - drawProgress)}
                opacity={interpolate(
                  drawProgress,
                  [0, 0.1],
                  [0, 0.8],
                  { extrapolateRight: 'clamp' },
                )}
              />
            );
          })}
        </svg>

        {/* Groups */}
        {groups.map((group, gi) => {
          const groupDelay = gi * 10;
          const groupOpacity = interpolate(
            frame,
            [groupDelay, groupDelay + 20],
            [0, 1],
            { extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={group.docId}
              style={{
                position: 'absolute',
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
                borderRadius: 8,
                border: `1px solid rgba(255,255,255,0.06)`,
                backgroundColor: 'rgba(255,255,255,0.02)',
                opacity: groupOpacity,
              }}
            >
              {/* Group header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: COLORS.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {group.filename}
                </span>
              </div>

              {/* Nodes */}
              {group.nodes.map((node, ni) => {
                const nodeDelay = groupDelay + 15 + ni * 8;
                const nodeScale = spring({
                  frame: frame - nodeDelay,
                  fps,
                  config: { damping: 200, stiffness: 120, mass: 0.5 },
                });
                const nodeOpacity = interpolate(
                  frame,
                  [nodeDelay, nodeDelay + 8],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                );

                return (
                  <div
                    key={node.id}
                    style={{
                      position: 'absolute',
                      left: node.x,
                      top: node.y,
                      width: NODE_W,
                      transform: `scale(${nodeScale})`,
                      opacity: nodeOpacity,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 6,
                        border: `1px solid rgba(255,255,255,0.08)`,
                        backgroundColor: COLORS.node,
                        padding: '8px 12px',
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: COLORS.text,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {node.label}
                      </p>
                      {node.tags.length > 0 && (
                        <p
                          style={{
                            fontSize: 10,
                            color: COLORS.textMuted,
                            marginTop: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {node.tags.map((t) => `#${t}`).join(' ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Edge labels appearing */}
        {EDGES.slice(0, 4).map((edge, i) => {
          const src = getNodeCenter(groups, edge.source);
          const tgt = getNodeCenter(groups, edge.target);
          if (!src || !tgt) return null;

          const labelDelay = 160 + i * 10;
          const labelOpacity = interpolate(
            frame,
            [labelDelay, labelDelay + 15],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          const color = EDGE_COLORS[edge.relType] ?? '#555';

          return (
            <div
              key={`label-${edge.id}`}
              style={{
                position: 'absolute',
                left: mx,
                top: my,
                transform: 'translate(-50%, -50%)',
                opacity: labelOpacity,
                borderRadius: 4,
                border: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.card,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 500,
                color,
                whiteSpace: 'nowrap',
              }}
            >
              {edge.relType.replace(/_/g, ' ')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DotGrid: React.FC = () => {
  const dots: React.ReactElement[] = [];
  for (let x = 0; x < 1920; x += 24) {
    for (let y = 0; y < 1080; y += 24) {
      dots.push(
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1} fill={COLORS.border} />,
      );
    }
  }
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {dots}
    </svg>
  );
};
