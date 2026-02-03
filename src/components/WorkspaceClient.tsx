'use client';

import { useRef, useState } from 'react';
import { Sidebar } from '@/components/documents/Sidebar';
import { GraphCanvas, type GraphCanvasHandle } from '@/components/graph/GraphCanvas';
import { NodeInspector, type NodeInspectorData } from '@/components/inspector/NodeInspector';
import { EdgeInspector } from '@/components/inspector/EdgeInspector';
import { ExportButton } from '@/components/graph/ExportButton';

type Document = {
  id: string;
  filename: string;
  status: string;
  sizeBytes: number;
};

type EdgeData = {
  relType: string;
  confidence: number;
  evidence: { documentId: string; filename: string; excerpt: string }[];
};

export function WorkspaceClient({
  projectId,
  projectName,
  initialDocuments,
}: {
  projectId: string;
  projectName: string;
  initialDocuments: Document[];
}) {
  const graphRef = useRef<GraphCanvasHandle>(null);
  const [selectedNode, setSelectedNode] = useState<NodeInspectorData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-64 shrink-0 border-r p-4 overflow-y-auto">
        <Sidebar
          projectId={projectId}
          initialDocuments={initialDocuments}
          onGraphRefresh={() => graphRef.current?.refresh()}
        />
        <div className="mt-4">
          <ExportButton projectId={projectId} projectName={projectName} />
        </div>
      </aside>

      <main className="flex-1">
        <GraphCanvas
          ref={graphRef}
          projectId={projectId}
          onNodeClick={(data) => {
            setSelectedNode(data);
            setSelectedEdge(null);
          }}
          onEdgeClick={(data) => {
            setSelectedEdge(data);
            setSelectedNode(null);
          }}
        />
      </main>

      {selectedNode && (
        <NodeInspector
          data={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {selectedEdge && (
        <aside className="w-80 shrink-0">
          <EdgeInspector
            edge={selectedEdge}
            onClose={() => setSelectedEdge(null)}
          />
        </aside>
      )}
    </div>
  );
}
