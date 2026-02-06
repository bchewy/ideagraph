'use client';

import { useCallback, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/documents/Sidebar';
import {
  GraphCanvas,
  type GraphFilters,
  type GraphMetadata,
} from '@/components/graph/GraphCanvas';
import { NodeInspector, type NodeInspectorData } from '@/components/inspector/NodeInspector';
import { EdgeInspector } from '@/components/inspector/EdgeInspector';
import { ExportButton } from '@/components/graph/ExportButton';
import { FilterPanel, DEFAULT_MIN_CONFIDENCE } from '@/components/graph/FilterPanel';
import type { EvidenceLocator, Id } from '@/lib/convex';

type EdgeData = {
  relType: string;
  confidence: number;
  reasoning?: string;
  evidence: { documentId: string; filename: string; excerpt: string; locator?: string }[];
};

const PdfEvidenceModal = dynamic(
  () =>
    import('@/components/documents/PdfEvidenceModal').then(
      (mod) => mod.PdfEvidenceModal
    ),
  { ssr: false }
);

export function WorkspaceClient({
  projectId,
  projectName,
}: {
  projectId: Id<"projects">;
  projectName: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeInspectorData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceFileUrl, setEvidenceFileUrl] = useState<string | null>(null);
  const [evidenceLocator, setEvidenceLocator] = useState<EvidenceLocator | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceExcerpt, setEvidenceExcerpt] = useState('');
  const [filters, setFilters] = useState<GraphFilters>({
    documentIds: [],
    edgeTypes: [],
    minConfidence: DEFAULT_MIN_CONFIDENCE,
  });
  const [graphMeta, setGraphMeta] = useState<GraphMetadata>({
    documents: [],
    edgeTypes: [],
  });

  const handleMetadata = useCallback((meta: GraphMetadata) => {
    setGraphMeta(meta);
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen ? (
        <aside className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Panel</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <Sidebar projectId={projectId} />
            <div className="mt-6 space-y-3">
              <FilterPanel
                documents={graphMeta.documents}
                edgeTypes={graphMeta.edgeTypes}
                onFilterChange={setFilters}
              />
              <ExportButton projectId={projectId} projectName={projectName} />
            </div>
          </div>
        </aside>
      ) : (
        <div className="shrink-0 border-r border-border flex flex-col items-center py-3 px-1.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeftOpen className="size-3.5" />
          </button>
        </div>
      )}

      {/* Graph */}
      <main className="flex-1 relative" data-onboarding="graph">
        <GraphCanvas
          projectId={projectId}
          filters={filters}
          onNodeClick={(data) => {
            setSelectedNode(data);
            setSelectedEdge(null);
          }}
          onEdgeClick={(data) => {
            setSelectedEdge(data);
            setSelectedNode(null);
          }}
          onMetadata={handleMetadata}
        />
      </main>

      {/* Inspectors */}
      {selectedNode && (
        <NodeInspector
          data={selectedNode}
          onClose={() => setSelectedNode(null)}
          onEvidenceClick={(source) => {
            const locator = source.locator
              ? (JSON.parse(source.locator) as EvidenceLocator)
              : null;
            setEvidenceTitle(source.filename);
            setEvidenceExcerpt(source.excerpt);
            setEvidenceFileUrl(
              `/api/projects/${projectId}/documents/${source.documentId}/file`
            );
            setEvidenceLocator(locator);
            setEvidenceOpen(true);
          }}
        />
      )}

      {selectedEdge && (
        <aside className="w-72 shrink-0">
          <EdgeInspector
            edge={selectedEdge}
            onClose={() => setSelectedEdge(null)}
            onEvidenceClick={(item) => {
              const locator = item.locator
                ? (JSON.parse(item.locator) as EvidenceLocator)
                : null;
              setEvidenceTitle(item.filename);
              setEvidenceExcerpt(item.excerpt);
              setEvidenceFileUrl(
                `/api/projects/${projectId}/documents/${item.documentId}/file`
              );
              setEvidenceLocator(locator);
              setEvidenceOpen(true);
            }}
          />
        </aside>
      )}

      <PdfEvidenceModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        title={evidenceTitle}
        excerpt={evidenceExcerpt}
        fileUrl={evidenceFileUrl}
        locator={evidenceLocator}
      />
    </div>
  );
}
