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

const PROJECTS = [
  { name: 'Transformer Architectures', date: 'Jan 28' },
  { name: 'Climate Policy Analysis', date: 'Jan 22' },
  { name: 'Microbiome Research', date: 'Jan 15' },
];

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const headerSlide = interpolate(frame, [0, 20], [-10, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const titleOpacity = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleSlide = interpolate(frame, [15, 40], [20, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const buttonScale = spring({
    frame: frame - 50,
    fps,
    config: { damping: 200, stiffness: 100, mass: 0.5 },
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
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          borderBottom: `1px solid ${COLORS.border}`,
          opacity: headerOpacity,
          transform: `translateY(${headerSlide}px)`,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.text,
            letterSpacing: '0.05em',
          }}
        >
          IdeaGraph
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: 500, textAlign: 'center' }}>
          {/* Title */}
          <h2
            style={{
              fontSize: 48,
              fontWeight: 300,
              color: COLORS.text,
              letterSpacing: '-0.02em',
              marginBottom: 12,
              opacity: titleOpacity,
              transform: `translateY(${titleSlide}px)`,
            }}
          >
            Your ideas, connected.
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 16,
              color: COLORS.textMuted,
              opacity: subtitleOpacity,
              marginBottom: 40,
            }}
          >
            Upload PDFs. Extract ideas. See how they relate.
          </p>

          {/* New Project button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 48,
              transform: `scale(${buttonScale})`,
            }}
          >
            <div
              style={{
                padding: '8px 20px',
                backgroundColor: COLORS.text,
                color: COLORS.background,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              + New Project
            </div>
          </div>

          {/* Project list */}
          <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
            {PROJECTS.map((project, i) => {
              const delay = 70 + i * 10;
              const itemOpacity = interpolate(
                frame,
                [delay, delay + 20],
                [0, 1],
                { extrapolateRight: 'clamp' },
              );
              const itemSlide = interpolate(
                frame,
                [delay, delay + 20],
                [12, 0],
                {
                  extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.cubic),
                },
              );

              return (
                <div
                  key={project.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 0',
                    borderBottom: `1px solid ${COLORS.border}`,
                    opacity: itemOpacity,
                    transform: `translateY(${itemSlide}px)`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: COLORS.text,
                    }}
                  >
                    {project.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {project.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '24px 32px',
          textAlign: 'center',
          opacity: subtitleOpacity,
        }}
      >
        <p style={{ fontSize: 12, color: COLORS.textMuted }}>
          Powered by GPT · 3 projects
        </p>
      </div>
    </div>
  );
};
