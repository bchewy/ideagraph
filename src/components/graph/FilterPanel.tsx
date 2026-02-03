'use client';

import { useState, useCallback } from 'react';

const EDGE_TYPE_LABELS: Record<string, string> = {
  supports: 'Supports',
  contradicts: 'Contradicts',
  extends: 'Extends',
  similar: 'Similar',
  example_of: 'Example of',
  depends_on: 'Depends on',
};

type FilterState = {
  documentIds: string[];
  edgeTypes: string[];
  minConfidence: number;
};

type FilterPanelProps = {
  documents: { id: string; filename: string }[];
  edgeTypes: string[];
  onFilterChange: (filters: FilterState) => void;
};

export function FilterPanel({
  documents,
  edgeTypes,
  onFilterChange,
}: FilterPanelProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState(0);

  const emitChange = useCallback(
    (
      nextDocs: string[],
      nextEdgeTypes: string[],
      nextConfidence: number,
    ) => {
      onFilterChange({
        documentIds: nextDocs,
        edgeTypes: nextEdgeTypes,
        minConfidence: nextConfidence,
      });
    },
    [onFilterChange],
  );

  function handleDocumentToggle(docId: string): void {
    const next = selectedDocumentIds.includes(docId)
      ? selectedDocumentIds.filter((id) => id !== docId)
      : [...selectedDocumentIds, docId];
    setSelectedDocumentIds(next);
    emitChange(next, selectedEdgeTypes, minConfidence);
  }

  function handleEdgeTypeToggle(edgeType: string): void {
    const next = selectedEdgeTypes.includes(edgeType)
      ? selectedEdgeTypes.filter((t) => t !== edgeType)
      : [...selectedEdgeTypes, edgeType];
    setSelectedEdgeTypes(next);
    emitChange(selectedDocumentIds, next, minConfidence);
  }

  function handleConfidenceChange(value: number): void {
    setMinConfidence(value);
    emitChange(selectedDocumentIds, selectedEdgeTypes, value);
  }

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold hover:bg-muted/50"
      >
        <span>Filters</span>
        <span className="text-xs text-muted-foreground">
          {collapsed ? '+' : '-'}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-4 px-3 pb-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Documents
            </legend>
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground">No documents</p>
            )}
            <div className="space-y-1">
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(doc.id)}
                    onChange={() => handleDocumentToggle(doc.id)}
                    className="rounded border-border"
                  />
                  <span className="truncate" title={doc.filename}>
                    {doc.filename}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Edge Types
            </legend>
            {edgeTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">No edge types</p>
            )}
            <div className="space-y-1">
              {edgeTypes.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEdgeTypes.includes(type)}
                    onChange={() => handleEdgeTypeToggle(type)}
                    className="rounded border-border"
                  />
                  <span>{EDGE_TYPE_LABELS[type] ?? type}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Min Confidence
            </legend>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) =>
                  handleConfidenceChange(Number(e.target.value))
                }
                className="h-2 w-full cursor-pointer accent-primary"
              />
              <span className="w-8 shrink-0 text-right text-xs tabular-nums">
                {minConfidence}%
              </span>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
