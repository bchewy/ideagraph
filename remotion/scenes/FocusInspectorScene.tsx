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
import {
  NODES,
  EDGES,
  INSPECTOR_NODE,
  INSPECTOR_CONNECTIONS,
  INSPECTOR_EVIDENCE,
} from '../lib/sample-data';

const REL_LABELS: Record<string, string> = {
  supports: 'Supports',
  contradicts: 'Contradicts',
  extends: 'Extends',
  similar: 'Similar',
  example_of: 'Example of',
  depends_on: 'Depends on',
};

const FOCUSED_NODE = INSPECTOR_NODE;
const CONNECTED_IDS = new Set(['n2', 'n3', 'n5']);
const ALL_RELATED = new Set(['n1', 'n2', 'n3', 'n5']);
const RELATED_EDGES = EDGES.filter(
  (e) => e.source === 'n1' || e.target === 'n1',
);

type PositionedNode = {
  id: string;
  label: string;
  tags: string[];
  x: number;
  y: number;
};

const FOCUS_NODES: PositionedNode[] = [
  { id: 'n1', label: NODES[0].label, tags: NODES[0].tags, x: 450, y: 340 },
  { id: 'n2', label: NODES[1].label, tags: NODES[1].tags, x: 250, y: 200 },
  { id: 'n3', label: NODES[2].label, tags: NODES[2].tags, x: 250, y: 480 },
  { id: 'n5', label: NODES[4].label, tags: NODES[4].tags, x: 700, y: 340 },
];

function getCenter(nodeId: string): { x: number; y: number } | null {
  const n = FOCUS_NODES.find((fn) => fn.id === nodeId);
  if (!n) return null;
  return { x: n.x + 100, y: n.y + 28 };
}

export const FocusInspectorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Click ring appears on selected node
  const clickFrame = 15;
  const ringScale = spring({
    frame: frame - clickFrame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.5 },
  });
  const ringOpacity = interpolate(
    frame,
    [clickFrame, clickFrame + 8, clickFrame + 30],
    [0, 0.5, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Dim unrelated nodes
  const focusProgress = interpolate(frame, [20, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Inspector slides in from right
  const inspectorSlide = spring({
    frame: frame - 30,
    fps,
    config: { damping: 200, stiffness: 80, mass: 0.8 },
  });
  const inspectorX = interpolate(inspectorSlide, [0, 1], [320, 0]);

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
          Focus Mode
        </div>
        <p style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
          Click any node to inspect its connections and evidence.
        </p>
      </div>

      {/* Canvas with focused nodes */}
      <div
        style={{
          flex: 1,
          backgroundColor: COLORS.canvas,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <DotGrid />

        {/* Edges between focused nodes */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {RELATED_EDGES.map((edge) => {
            const src = getCenter(edge.source);
            const tgt = getCenter(edge.target);
            if (!src || !tgt) return null;

            const color = EDGE_COLORS[edge.relType] ?? '#555';
            const edgeOpacity = interpolate(focusProgress, [0, 1], [0.3, 0.8]);

            const dx = tgt.x - src.x;
            const cx1 = src.x + dx * 0.3;
            const cy1 = src.y;
            const cx2 = tgt.x - dx * 0.3;
            const cy2 = tgt.y;

            return (
              <path
                key={edge.id}
                d={`M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgt.x} ${tgt.y}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={edgeOpacity}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {FOCUS_NODES.map((node) => {
          const isSelected = node.id === FOCUSED_NODE.id;
          const isConnected = CONNECTED_IDS.has(node.id);
          const dimAmount = isSelected || isConnected ? 0 : focusProgress * 0.7;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: 200,
                opacity: 1 - dimAmount,
              }}
            >
              {/* Selection ring */}
              {isSelected && frame >= clickFrame && (
                <div
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: 10,
                    border: '2px solid rgba(255,255,255,0.3)',
                    opacity: ringOpacity,
                    transform: `scale(${ringScale})`,
                  }}
                />
              )}
              {/* Persistent highlight for selected */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    inset: -2,
                    borderRadius: 8,
                    border: `1px solid rgba(255,255,255,${interpolate(
                      focusProgress,
                      [0, 1],
                      [0.08, 0.25],
                    )})`,
                  }}
                />
              )}
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

      {/* Inspector panel sliding in */}
      <div
        style={{
          width: 320,
          borderLeft: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.background,
          transform: `translateX(${inspectorX}px)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `1px solid ${COLORS.border}`,
            padding: '12px 16px',
          }}
        >
          <h2
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {FOCUSED_NODE.label}
          </h2>
          <span
            style={{
              fontSize: 10,
              color: COLORS.textMuted,
              cursor: 'pointer',
            }}
          >
            ✕
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', padding: 16 }}>
          {/* Summary section */}
          <InspectorSection
            title="Summary"
            delay={50}
            frame={frame}
          >
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.6,
              }}
            >
              {FOCUSED_NODE.summary}
            </p>
          </InspectorSection>

          {/* Tags */}
          <InspectorSection
            title="Tags"
            delay={60}
            frame={frame}
          >
            <p style={{ fontSize: 12, color: COLORS.textMuted }}>
              {FOCUSED_NODE.tags.map((t) => `#${t}`).join('  ')}
            </p>
          </InspectorSection>

          {/* Connections */}
          <InspectorSection
            title={`Connections (${INSPECTOR_CONNECTIONS.length})`}
            delay={70}
            frame={frame}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {INSPECTOR_CONNECTIONS.map((conn, i) => {
                const connDelay = 80 + i * 10;
                const connOpacity = interpolate(
                  frame,
                  [connDelay, connDelay + 12],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                );
                const color = EDGE_COLORS[conn.relType] ?? '#666';

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      padding: '8px 10px',
                      opacity: connOpacity,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: color,
                        marginTop: 4,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: COLORS.text,
                          lineHeight: 1.4,
                        }}
                      >
                        {conn.label}
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          color: COLORS.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {REL_LABELS[conn.relType] ?? conn.relType} ·{' '}
                        {Math.round(conn.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </InspectorSection>

          {/* Evidence */}
          <InspectorSection
            title={`Evidence (${INSPECTOR_EVIDENCE.length})`}
            delay={110}
            frame={frame}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INSPECTOR_EVIDENCE.map((ev, i) => {
                const evDelay = 120 + i * 10;
                const evOpacity = interpolate(
                  frame,
                  [evDelay, evDelay + 12],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                );

                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      padding: '8px 12px',
                      opacity: evOpacity,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: COLORS.textMuted,
                        marginBottom: 4,
                      }}
                    >
                      {ev.filename}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}
                    >
                      &ldquo;{ev.excerpt}&rdquo;
                    </p>
                  </div>
                );
              })}
            </div>
          </InspectorSection>
        </div>
      </div>
    </div>
  );
};

const InspectorSection: React.FC<{
  title: string;
  delay: number;
  frame: number;
  children: React.ReactNode;
}> = ({ title, delay, frame, children }) => {
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slide = interpolate(frame, [delay, delay + 12], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        marginBottom: 20,
        opacity,
        transform: `translateY(${slide}px)`,
      }}
    >
      <h3
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        {title}
      </h3>
      {children}
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
