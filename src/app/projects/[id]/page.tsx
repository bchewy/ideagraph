'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api, type Id } from '@/lib/convex';
import { WorkspaceClient } from '@/components/WorkspaceClient';

export default function ProjectWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id as Id<"projects">;
  const project = useQuery(api.projects.get, { id: projectId });

  if (project === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center border-b border-border px-6 py-3">
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </Link>
        <span className="mx-3 text-border">|</span>
        <h1 className="text-sm font-medium">{project.name}</h1>
      </header>

      <WorkspaceClient projectId={projectId} projectName={project.name} />
    </div>
  );
}
