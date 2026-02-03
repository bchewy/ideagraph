'use client';

import { X, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const EDGE_TYPE_COLORS: Record<string, string> = {
  supports: 'bg-green-600 text-white',
  contradicts: 'bg-red-600 text-white',
  extends: 'bg-blue-600 text-white',
  similar: 'bg-purple-600 text-white',
  example_of: 'bg-amber-600 text-white',
  depends_on: 'bg-cyan-600 text-white',
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  supports: 'Supports',
  contradicts: 'Contradicts',
  extends: 'Extends',
  similar: 'Similar',
  example_of: 'Example Of',
  depends_on: 'Depends On',
};

type EvidenceItem = {
  documentId: string;
  filename: string;
  excerpt: string;
};

type EdgeInspectorProps = {
  edge: {
    relType: string;
    confidence: number;
    evidence: EvidenceItem[];
  };
  onClose: () => void;
};

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function EdgeInspector({ edge, onClose }: EdgeInspectorProps) {
  const { relType, confidence, evidence } = edge;
  const badgeColor = EDGE_TYPE_COLORS[relType] ?? 'bg-muted text-muted-foreground';
  const displayLabel = EDGE_TYPE_LABELS[relType] ?? relType;

  return (
    <div className="flex h-full flex-col overflow-hidden border-l bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">
          Relationship
        </h2>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Type</p>
          <Badge className={badgeColor}>{displayLabel}</Badge>
        </section>

        <section>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Confidence
          </p>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatConfidence(confidence)}
            </span>
          </div>
        </section>

        {evidence.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Evidence ({evidence.length})
            </p>
            <ul className="space-y-3">
              {evidence.map((item, index) => (
                <li
                  key={`${item.documentId}-${index}`}
                  className="rounded-lg border bg-muted/40 p-3"
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="size-3 shrink-0" />
                    <span className="truncate">{item.filename}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-card-foreground">
                    {item.excerpt}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
