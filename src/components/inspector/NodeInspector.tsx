'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';

export type LinkedNode = {
  label: string;
  relType: string;
  confidence: number;
};

export type NodeInspectorData = {
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string }[];
  linkedNodes?: LinkedNode[];
};

const REL_LABELS: Record<string, string> = {
  supports: 'Supports',
  contradicts: 'Contradicts',
  extends: 'Extends',
  similar: 'Similar',
  example_of: 'Example of',
  depends_on: 'Depends on',
};

const REL_COLORS: Record<string, string> = {
  supports: '#4ade80',
  contradicts: '#f87171',
  extends: '#60a5fa',
  similar: '#c084fc',
  example_of: '#fb923c',
  depends_on: '#2dd4bf',
};

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

export function NodeInspector({
  data,
  onClose,
}: {
  data: NodeInspectorData;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // dragging left = wider
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    }
    function onMouseUp() {
      dragging.current = false;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const linked = data.linkedNodes ?? [];

  return (
    <aside
      style={{ width }}
      className="shrink-0 border-l border-border bg-background flex flex-col overflow-hidden select-none"
    >
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/10 transition-colors z-10"
      />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div
          onMouseDown={onMouseDown}
          className="cursor-col-resize text-muted-foreground/40 hover:text-muted-foreground"
        >
          <GripVertical className="size-3" />
        </div>
        <h2 className="flex-1 text-xs font-semibold truncate">{data.label}</h2>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4">
          {/* Summary */}
          <section>
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Summary
            </h3>
            <p className="text-xs leading-relaxed text-foreground/80">{data.summary}</p>
          </section>

          {/* Tags */}
          {data.tags.length > 0 && (
            <section>
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Tags
              </h3>
              <p className="text-xs text-muted-foreground">
                {data.tags.map((t) => `#${t}`).join('  ')}
              </p>
            </section>
          )}

          {/* Linked ideas */}
          {linked.length > 0 && (
            <section>
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Connections ({linked.length})
              </h3>
              <div className="flex flex-col gap-1.5">
                {linked.map((link, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded border border-border px-2.5 py-2"
                  >
                    <span
                      className="mt-0.5 shrink-0 size-1.5 rounded-full"
                      style={{ backgroundColor: REL_COLORS[link.relType] ?? '#666' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground leading-snug truncate">
                        {link.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {REL_LABELS[link.relType] ?? link.relType} · {Math.round(link.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Evidence */}
          {data.sources.length > 0 && (
            <section>
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Evidence ({data.sources.length})
              </h3>
              <div className="flex flex-col gap-2">
                {data.sources.map((source, index) => (
                  <div
                    key={`${source.documentId}-${index}`}
                    className="rounded border border-border px-3 py-2"
                  >
                    <p className="text-[10px] text-muted-foreground mb-1">{source.filename}</p>
                    <p className="text-xs leading-relaxed text-foreground/70 italic">
                      &ldquo;{source.excerpt}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}
