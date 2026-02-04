export const COLORS = {
  background: '#000000',
  canvas: '#141414',
  card: '#0a0a0a',
  node: '#0c0c0c',
  border: '#1a1a1a',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderNode: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: '#666666',
  textDim: 'rgba(255,255,255,0.30)',
  secondary: '#111111',
  sidebar: '#050505',
} as const;

export const EDGE_COLORS: Record<string, string> = {
  supports: '#4ade80',
  contradicts: '#f87171',
  extends: '#60a5fa',
  similar: '#c084fc',
  example_of: '#fb923c',
  depends_on: '#2dd4bf',
};

export const FPS = 30;
export const LANDSCAPE_WIDTH = 1920;
export const LANDSCAPE_HEIGHT = 1080;
export const SHORT_WIDTH = 1080;
export const SHORT_HEIGHT = 1920;
export const TOTAL_FRAMES = 975;
