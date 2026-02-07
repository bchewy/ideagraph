'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, GripVertical, Crosshair, FileText, SlidersHorizontal } from 'lucide-react';

export type LinkedNode = {
  label: string;
  relType: string;
  confidence: number;
  reasoning?: string;
};

export type NodeInspectorData = {
  label: string;
  summary: string;
  tags: string[];
  sources: {
    documentId: string;
    filename: string;
    excerpt: string;
    locator?: string;
  }[];
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

function ConnectionsSection({ linked }: { linked: LinkedNode[] }) {
  // Connection filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRelTypes, setSelectedRelTypes] = useState<Set<string>>(
    new Set()
  );
  const [minConfidence, setMinConfidence] = useState(0);

  // Gather unique rel types present in this node's connections
  const availableRelTypes = useMemo(
    () => Array.from(new Set(linked.map((l) => l.relType))),
    [linked]
  );

  const filteredLinked = useMemo(() => {
    return linked.filter((l) => {
      if (selectedRelTypes.size > 0 && !selectedRelTypes.has(l.relType))
        return false;
      if (Math.round(l.confidence * 100) < minConfidence) return false;
      return true;
    });
  }, [linked, selectedRelTypes, minConfidence]);

  function toggleRelType(relType: string) {
    setSelectedRelTypes((prev) => {
      const next = new Set(prev);
      if (next.has(relType)) next.delete(relType);
      else next.add(relType);
      return next;
    });
  }

  const hasActiveFilters = selectedRelTypes.size > 0 || minConfidence > 0;

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Connections
          {hasActiveFilters
            ? ` (${filteredLinked.length}/${linked.length})`
            : ` (${linked.length})`}
        </h3>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`p-1 rounded transition-colors ${
            showFilters || hasActiveFilters
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Filter connections"
        >
          <SlidersHorizontal className="size-3" />
        </button>
      </div>

      {/* Inline filter controls */}
      {showFilters && (
        <div className="mb-3 rounded border border-border bg-muted/30 p-2.5 flex flex-col gap-2.5">
          {/* Relationship type pills */}
          <div>
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Type
            </p>
            <div className="flex flex-wrap gap-1">
              {availableRelTypes.map((rt) => {
                const active =
                  selectedRelTypes.size === 0 || selectedRelTypes.has(rt);
                const color = REL_COLORS[rt] ?? '#666';
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => toggleRelType(rt)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                      active
                        ? 'border-border bg-background text-foreground'
                        : 'border-transparent bg-muted/50 text-muted-foreground/50'
                    }`}
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: color,
                        opacity: active ? 1 : 0.35,
                      }}
                    />
                    {REL_LABELS[rt] ?? rt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Min confidence slider */}
          <div>
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Min Confidence
            </p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-primary"
              />
              <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {minConfidence}%
              </span>
            </div>
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedRelTypes(new Set());
                setMinConfidence(0);
              }}
              className="self-start text-[10px] text-primary hover:text-primary/80 transition-colors"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Connection cards */}
      <div className="flex flex-col gap-1.5">
        {filteredLinked.length === 0 ? (
          <p className="text-[10px] text-muted-foreground py-2 text-center">
            No connections match the current filters.
          </p>
        ) : (
          filteredLinked.map((link, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded border border-border px-2.5 py-2"
            >
              <span
                className="mt-1 shrink-0 size-1.5 rounded-full"
                style={{ backgroundColor: REL_COLORS[link.relType] ?? '#666' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground leading-snug break-words whitespace-normal">
                  {link.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {REL_LABELS[link.relType] ?? link.relType} ·{' '}
                  {Math.round(link.confidence * 100)}%
                </p>
                {link.reasoning && (
                  <p className="text-[10px] leading-relaxed text-foreground/60 mt-1 break-words whitespace-normal">
                    {link.reasoning}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function NodeInspector({
  data,
  onClose,
  onEvidenceClick,
}: {
  data: NodeInspectorData;
  onClose: () => void;
  onEvidenceClick?: (source: NodeInspectorData['sources'][number]) => void;
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
            <ConnectionsSection
              key={`${data.label}|${data.summary}`}
              linked={linked}
            />
          )}

          {/* Evidence */}
          {data.sources.length > 0 && (
            <section>
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Evidence ({data.sources.length})
              </h3>
              <div className="flex flex-col gap-2">
                {data.sources.map((source, index) => {
                  const hasLocator = Boolean(source.locator);
                  return (
                    <button
                      key={`${source.documentId}-${index}`}
                      type="button"
                      onClick={() => onEvidenceClick?.(source)}
                      className="group rounded border border-border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {hasLocator ? (
                          <Crosshair className="size-2.5 text-primary shrink-0" />
                        ) : (
                          <FileText className="size-2.5 text-muted-foreground/50 shrink-0" />
                        )}
                        <p className="text-[10px] text-muted-foreground truncate">{source.filename}</p>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/70 italic">
                        &ldquo;{source.excerpt}&rdquo;
                      </p>
                      <p className="text-[10px] text-primary/0 group-hover:text-primary/60 transition-colors mt-1">
                        {hasLocator ? 'Click to view highlighted in PDF' : 'Click to view in PDF'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}
