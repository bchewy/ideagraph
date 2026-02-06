'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { AsciiLoader } from '@/components/AsciiLoader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function Home() {
  const projectList = useQuery(api.projects.list);
  const clearAll = useMutation(api.projects.clearAll);
  const [showClearDialog, setShowClearDialog] = useState(false);

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

      <footer className="px-8 py-6 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Powered by GPT · {projectList.length} project{projectList.length !== 1 ? 's' : ''}
        </p>
        {process.env.NODE_ENV !== 'production' && projectList.length > 0 && (
          <>
            <button
              onClick={() => setShowClearDialog(true)}
              className="text-xs text-destructive/60 hover:text-destructive transition-colors"
            >
              Clear all data
            </button>
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
              <DialogContent showCloseButton={false} className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Clear all data?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete all {projectList.length} project{projectList.length !== 1 ? 's' : ''} and their documents, ideas, and connections. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      clearAll();
                      setShowClearDialog(false);
                    }}
                  >
                    Delete everything
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </footer>
    </div>
  );
}
