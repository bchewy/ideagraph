'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { AsciiLoader } from '@/components/AsciiLoader';

export default function Home() {
  const projectList = useQuery(api.projects.list);

  if (projectList === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AsciiLoader label="Loading projects" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-border">
        <h1 className="text-sm font-medium tracking-wide">IdeaGraph</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-lg">
          {/* Title area */}
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-light tracking-tight mb-3">
              Your ideas, connected.
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload PDFs. Extract ideas. See how they relate.
            </p>
          </div>

          {/* New project */}
          <div className="mb-10 flex justify-center">
            <CreateProjectDialog />
          </div>

          {/* Project list */}
          {projectList.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No projects yet.
            </p>
          ) : (
            <div className="border-t border-border">
              {projectList.map((project) => (
                <div
                  key={project._id}
                  className="group flex items-center justify-between border-b border-border"
                >
                  <Link
                    href={`/projects/${project._id}`}
                    className="flex-1 py-4 flex items-baseline justify-between pr-4 hover:opacity-60 transition-opacity"
                  >
                    <span className="text-sm font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(project._creationTime).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </Link>
                  <DeleteProjectButton projectId={project._id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="px-8 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by GPT · {projectList.length} project{projectList.length !== 1 ? 's' : ''}
        </p>
      </footer>
    </div>
  );
}
