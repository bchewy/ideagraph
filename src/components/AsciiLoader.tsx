'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_FRAMES = [
  'o..\n...\n...',
  '.o.\n...\n...',
  '..o\n...\n...',
  '...\n..o\n...',
  '...\n...\n..o',
  '...\n...\n.o.',
  '...\n...\no..',
  '...\no..\n...',
];

const sizeStyles = {
  sm: 'text-[10px] leading-[7px] tracking-[-0.08em]',
  md: 'text-[12px] leading-[9px] tracking-[-0.08em]',
  lg: 'text-[14px] leading-[10px] tracking-[-0.08em]',
};

type AsciiLoaderProps = {
  label?: string;
  className?: string;
  speedMs?: number;
  size?: keyof typeof sizeStyles;
};

export function AsciiLoader({
  label = 'Loading',
  className,
  speedMs = 120,
  size = 'md',
}: AsciiLoaderProps) {
  const frames = useMemo(() => DEFAULT_FRAMES, []);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % frames.length);
    }, speedMs);
    return () => window.clearInterval(interval);
  }, [frames.length, speedMs]);

  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-2 text-muted-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      <pre className={`font-mono ${sizeStyles[size]}`} aria-hidden="true">
        {frames[frame]}
      </pre>
      <span className="text-xs tracking-wide uppercase">{label}</span>
    </div>
  );
}
