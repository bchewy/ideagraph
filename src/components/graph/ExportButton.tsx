'use client';

import { useQuery } from 'convex/react';
import { api, type Id } from '@/lib/convex';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ExportButtonProps = {
  projectId: Id<"projects">;
  projectName: string;
};

export function ExportButton({ projectId, projectName }: ExportButtonProps): React.JSX.Element {
  const graph = useQuery(api.graph.get, { projectId });

  function handleExport(): void {
    if (!graph) return;
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${safeName}-graph-${date}.json`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!graph}
      onClick={handleExport}
    >
      <Download />
      Export JSON
    </Button>
  );
}
