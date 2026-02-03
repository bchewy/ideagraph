'use client';

import { useRef } from 'react';
import { Sidebar } from '@/components/documents/Sidebar';
import { GraphCanvas, type GraphCanvasHandle } from '@/components/graph/GraphCanvas';

type Document = {
  id: string;
  filename: string;
  status: string;
  sizeBytes: number;
};

export function WorkspaceClient({
  projectId,
  initialDocuments,
}: {
  projectId: string;
  initialDocuments: Document[];
}) {
  const graphRef = useRef<GraphCanvasHandle>(null);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-64 shrink-0 border-r p-4 overflow-y-auto">
        <Sidebar
          projectId={projectId}
          initialDocuments={initialDocuments}
          onGraphRefresh={() => graphRef.current?.refresh()}
        />
      </aside>

      <main className="flex-1">
        <GraphCanvas ref={graphRef} projectId={projectId} />
      </main>
    </div>
  );
}
