import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject, getDocuments } from '@/app/actions';
import { Sidebar } from '@/components/documents/Sidebar';

export default async function ProjectWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const docs = await getDocuments(id);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Projects
          </Link>
          <h1 className="text-lg font-semibold">{project.name}</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 border-r p-4 overflow-y-auto">
          <Sidebar projectId={id} initialDocuments={docs} />
        </aside>

        <main className="flex-1 bg-muted/30">
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Graph canvas will appear here
          </div>
        </main>

        {/* Inspector panel - hidden by default, shown when node/edge selected */}
      </div>
    </div>
  );
}
