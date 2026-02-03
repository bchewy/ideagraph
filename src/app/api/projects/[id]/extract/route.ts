import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (project.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const documentIds: string[] = body.documentIds;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json(
      { error: 'documentIds array is required' },
      { status: 400 }
    );
  }

  const jobId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(jobs).values({
    id: jobId,
    projectId,
    type: 'extraction',
    status: 'pending',
    createdAt: now,
  });

  runExtraction(jobId, projectId, documentIds).catch((err) => {
    console.error('Extraction failed:', err);
  });

  return NextResponse.json({ jobId });
}

async function runExtraction(
  jobId: string,
  projectId: string,
  documentIds: string[]
) {
  await db
    .update(jobs)
    .set({ status: 'running' })
    .where(eq(jobs.id, jobId));

  try {
    const { extractIdeas } = await import('@/lib/openai/extract');
    await extractIdeas(projectId, documentIds);

    const now = Math.floor(Date.now() / 1000);
    await db
      .update(jobs)
      .set({ status: 'completed', completedAt: now })
      .where(eq(jobs.id, jobId));
  } catch (err) {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(jobs)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
        completedAt: now,
      })
      .where(eq(jobs.id, jobId));
  }
}
