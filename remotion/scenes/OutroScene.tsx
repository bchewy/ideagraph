import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { fontFamily } from '../lib/fonts';
import { COLORS, EDGE_COLORS } from '../lib/constants';

const MINI_NODES = [
  { cx: 0, cy: -18 },
  { cx: -20, cy: 8 },
  { cx: 20, cy: 8 },
  { cx: -10, cy: -5 },
  { cx: 10, cy: -5 },
];

const MINI_EDGES: [number, number][] = [
  [0, 3],
  [0, 4],
  [3, 1],
  [4, 2],
  [3, 4],
  [1, 2],
];

const MINI_COLORS = [
  EDGE_COLORS.supports,
  EDGE_COLORS.extends,
  EDGE_COLORS.similar,
  EDGE_COLORS.depends_on,
  EDGE_COLORS.contradicts,
  EDGE_COLORS.example_of,
];

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });

  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleSlide = interpolate(frame, [10, 25], [15, 0], {
    extrapolateRight: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      {/* Mini network icon */}
      <div style={{ transform: `scale(${iconScale})` }}>
        <svg width={80} height={60} viewBox="-35 -30 70 55">
          {MINI_EDGES.map(([from, to], i) => (
            <line
              key={`edge-${i}`}
              x1={MINI_NODES[from].cx}
              y1={MINI_NODES[from].cy}
              x2={MINI_NODES[to].cx}
              y2={MINI_NODES[to].cy}
              stroke={MINI_COLORS[i % MINI_COLORS.length]}
              strokeWidth={1.5}
              opacity={0.6}
            />
          ))}
          {MINI_NODES.map((node, i) => (
            <circle
              key={`node-${i}`}
              cx={node.cx}
              cy={node.cy}
              r={3.5}
              fill={COLORS.text}
              opacity={0.9}
            />
          ))}
        </svg>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 42,
          fontWeight: 300,
          color: COLORS.text,
          letterSpacing: '-0.02em',
          opacity: titleOpacity,
          transform: `translateY(${titleSlide}px)`,
        }}
      >
        IdeaGraph
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 16,
          color: COLORS.textMuted,
          opacity: taglineOpacity,
        }}
      >
        Your ideas, connected.
      </p>
    </div>
  );
};
