import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { getProjects } from './actions';

export default async function Home() {
  const projectList = await getProjects();

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IdeaGraph</h1>
          <p className="text-muted-foreground">
            Extract ideas from PDFs and explore them as a knowledge graph.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {projectList.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <div className="grid gap-4">
          {projectList.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Created {new Date(project.createdAt * 1000).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
