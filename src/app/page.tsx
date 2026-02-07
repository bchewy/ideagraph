'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { AsciiLoader } from '@/components/AsciiLoader';
import {
  FileText,
  Cpu,
  GitFork,
  ChevronRight,
} from 'lucide-react';
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

const STEPS = [
  {
    icon: FileText,
    title: 'Upload your PDFs',
    description:
      'Drop in research papers, reports, or any documents you want to analyze.',
  },
  {
    icon: Cpu,
    title: 'AI extracts ideas',
    description:
      'GPT reads every page and pulls out the key ideas, claims, and concepts.',
  },
  {
    icon: GitFork,
    title: 'See the connections',
    description:
      'Ideas are linked into an interactive graph — supports, contradicts, extends, and more.',
  },
];

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
      <header className="flex items-center justify-between px-8 py-5 border-b border-border">
        <h1 className="text-sm font-medium tracking-wide">IdeaGraph</h1>
        <CreateProjectDialog />
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-8 pt-24 pb-20">
          <div className="max-w-2xl text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">
              Knowledge graph for your research
            </p>
            <h2 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.15] mb-5">
              Stop reading in silos.
              <br />
              <span className="text-muted-foreground">
                See how ideas connect.
              </span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto mb-10">
              IdeaGraph reads your PDFs, extracts the key ideas, and maps the
              relationships between them — so you can see the big picture
              across all your documents.
            </p>
            <CreateProjectDialog variant="hero" />
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border px-8 py-16">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-10 text-center">
              How it works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="size-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                    <step.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Step {i + 1}
                  </div>
                  <h4 className="text-sm font-medium mb-2">{step.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem / Value prop */}
        <section className="border-t border-border px-8 py-16">
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
                The problem
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Research means reading dozens of papers. Ideas overlap,
                contradict, and build on each other — but those connections
                live only in your head. Important links get lost.
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
                The solution
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                IdeaGraph builds a knowledge graph from your documents
                automatically. Every idea is traced back to the exact excerpt
                in the PDF, so nothing is invented and everything is
                verifiable.
              </p>
            </div>
          </div>
        </section>

        {/* Projects */}
        <section className="border-t border-border px-8 py-16 flex-1">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
                Your projects
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {projectList.length} project
                {projectList.length !== 1 ? 's' : ''}
              </span>
            </div>

            {projectList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No projects yet. Create one to get started.
                </p>
                <CreateProjectDialog />
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {projectList.map((project, i) => (
                  <div
                    key={project._id}
                    className={`group flex items-center justify-between ${
                      i !== 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <Link
                      href={`/projects/${project._id}`}
                      className="flex-1 py-3.5 px-4 flex items-center justify-between pr-2 hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        {project.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(
                            project._creationTime,
                          ).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </Link>
                    <DeleteProjectButton projectId={project._id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="px-8 py-6 border-t border-border text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Powered by GPT &middot; Built with Convex &amp; React Flow
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
                    This will permanently delete all {projectList.length}{' '}
                    project{projectList.length !== 1 ? 's' : ''} and their
                    documents, ideas, and connections. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
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
