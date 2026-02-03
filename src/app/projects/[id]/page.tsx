import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject, getDocuments } from '@/app/actions';
import { WorkspaceClient } from '@/components/WorkspaceClient';

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

      <WorkspaceClient projectId={id} initialDocuments={docs} />
    </div>
  );
}
