import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion';
import { fontFamily } from '../lib/fonts';
import { COLORS } from '../lib/constants';
import { NODES } from '../lib/sample-data';

const EXTRACTION_NODES = NODES.slice(0, 8);

export const ExtractionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Progress bar
  const progressStart = 10;
  const progressEnd = 140;
  const progress = interpolate(
    frame,
    [progressStart, progressEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const progressPercent = Math.round(progress * 100);

  // Status text
  const statusText =
    frame < 30
      ? 'Analyzing document...'
      : frame < 80
        ? 'Extracting ideas with GPT-4.1...'
        : frame < 140
          ? 'Processing structured outputs...'
          : 'Extraction complete';

  const statusColor = frame >= 140 ? '#4ade80' : COLORS.textMuted;

  // Node cards materializing
  const canvasOpacity = interpolate(frame, [0, 10], [0, 1], {
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
      }}
    >
      {/* Sidebar with progress */}
      <div
        style={{
          width: 240,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
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
            marginBottom: 16,
          }}
        >
          Extracting
        </div>

        {/* File being processed */}
        <div
          style={{
            fontSize: 12,
            color: COLORS.text,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <LoadingSpinner frame={frame} />
          <span>attention-mechanisms.pdf</span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: 4,
            backgroundColor: COLORS.border,
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: COLORS.text,
              borderRadius: 2,
            }}
          />
        </div>

        <p
          style={{
            fontSize: 11,
            color: statusColor,
            marginBottom: 4,
          }}
        >
          {statusText}
        </p>

        <p
          style={{
            fontSize: 10,
            color: COLORS.textMuted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.min(EXTRACTION_NODES.length, Math.floor(progress * EXTRACTION_NODES.length + 0.5))}{' '}
          / {EXTRACTION_NODES.length} ideas
        </p>
      </div>

      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          backgroundColor: COLORS.canvas,
          position: 'relative',
          overflow: 'hidden',
          opacity: canvasOpacity,
        }}
      >
        {/* Dot grid background */}
        <DotGrid />

        {/* Nodes appearing */}
        {EXTRACTION_NODES.map((node, i) => {
          const appearFrame = 25 + i * 12;
          const nodeSpring = spring({
            frame: frame - appearFrame,
            fps,
            config: { damping: 12, stiffness: 100, mass: 0.6 },
          });
          const nodeOpacity = interpolate(
            frame,
            [appearFrame, appearFrame + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = 200 + col * 240;
          const y = 200 + row * 160;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: `scale(${nodeSpring})`,
                opacity: nodeOpacity,
              }}
            >
              <NodeCard label={node.label} tags={node.tags} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const NodeCard: React.FC<{ label: string; tags: string[] }> = ({
  label,
  tags,
}) => (
  <div
    style={{
      width: 200,
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
      {label}
    </p>
    {tags.length > 0 && (
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
        {tags.map((t) => `#${t}`).join(' ')}
      </p>
    )}
  </div>
);

const LoadingSpinner: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = (frame * 8) % 360;
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <circle
        cx={12}
        cy={12}
        r={9}
        fill="none"
        stroke={COLORS.textMuted}
        strokeWidth={2}
        strokeDasharray="42 14"
        strokeLinecap="round"
      />
    </svg>
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
