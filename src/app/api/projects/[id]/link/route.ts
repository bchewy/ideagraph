import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(
  _request: NextRequest,
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

  const jobId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(jobs).values({
    id: jobId,
    projectId,
    type: 'linking',
    status: 'pending',
    createdAt: now,
  });

  runLinking(jobId, projectId).catch((err) => {
    console.error('Linking failed:', err);
  });

  return NextResponse.json({ jobId });
}

async function runLinking(jobId: string, projectId: string) {
  await db
    .update(jobs)
    .set({ status: 'running' })
    .where(eq(jobs.id, jobId));

  try {
    const { generateEmbeddings } = await import('@/lib/openai/embeddings');
    await generateEmbeddings(projectId);

    const { getCandidatePairs, classifyRelationships } = await import(
      '@/lib/openai/link'
    );
    const pairs = await getCandidatePairs(projectId);
    await classifyRelationships(projectId, pairs);

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
