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

const SIDEBAR_DOCS = ['attention-mechanisms.pdf'];

export const UploadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chromeOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // PDF file drops in from above
  const dropProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.6 },
  });
  const fileY = interpolate(dropProgress, [0, 1], [-80, 0]);
  const fileOpacity = interpolate(frame, [30, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Dropzone border pulse
  const dropzoneActive = frame > 30 && frame < 100;
  const borderPulse = dropzoneActive
    ? interpolate(
        Math.sin(((frame - 30) / 30) * Math.PI * 2),
        [-1, 1],
        [0.1, 0.3],
      )
    : 0.08;

  // Upload progress bar
  const uploadStartFrame = 60;
  const uploadProgress = interpolate(
    frame,
    [uploadStartFrame, uploadStartFrame + 60],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Success check
  const checkOpacity = interpolate(frame, [130, 140], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const checkScale = spring({
    frame: frame - 130,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.5 },
  });

  // Second doc appears in sidebar
  const secondDocOpacity = interpolate(frame, [140, 155], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const secondDocSlide = interpolate(frame, [140, 155], [8, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        fontFamily,
        display: 'flex',
        opacity: chromeOpacity,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
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
        {SIDEBAR_DOCS.map((doc) => (
          <div
            key={doc}
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              padding: '8px 0',
              borderBottom: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ color: COLORS.textMuted, fontSize: 10 }}>PDF</span>
            <span style={{ color: COLORS.text }}>{doc}</span>
          </div>
        ))}
        {/* Second document sliding in */}
        <div
          style={{
            fontSize: 12,
            color: COLORS.textMuted,
            padding: '8px 0',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: secondDocOpacity,
            transform: `translateY(${secondDocSlide}px)`,
          }}
        >
          <span style={{ color: COLORS.textMuted, fontSize: 10 }}>PDF</span>
          <span style={{ color: COLORS.text }}>neural-scaling-laws.pdf</span>
        </div>
      </div>

      {/* Main area with dropzone */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.canvas,
          position: 'relative',
        }}
      >
        {/* Dropzone */}
        <div
          style={{
            width: 400,
            height: 220,
            border: `2px dashed rgba(255,255,255,${borderPulse})`,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            position: 'relative',
          }}
        >
          {/* Upload icon */}
          <svg
            width={32}
            height={32}
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.textMuted}
            strokeWidth={1.5}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>

          <p style={{ fontSize: 13, color: COLORS.textMuted }}>
            Drop PDF here or click to browse
          </p>

          {/* Floating file card */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, calc(-50% + ${fileY}px))`,
              opacity: fileOpacity,
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f87171"
              strokeWidth={1.5}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
            <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>
              neural-scaling-laws.pdf
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {frame > uploadStartFrame && (
          <div
            style={{
              width: 300,
              marginTop: 20,
              height: 4,
              backgroundColor: COLORS.border,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${uploadProgress * 100}%`,
                height: '100%',
                backgroundColor: COLORS.text,
                borderRadius: 2,
              }}
            />
          </div>
        )}

        {/* Success check */}
        {frame > 130 && (
          <div
            style={{
              marginTop: 12,
              opacity: checkOpacity,
              transform: `scale(${checkScale})`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ade80"
              strokeWidth={2}
            >
              <polyline points="20,6 9,17 4,12" />
            </svg>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Uploaded</span>
          </div>
        )}
      </div>
    </div>
  );
};
