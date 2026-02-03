import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db.select().from(jobs).where(eq(jobs.id, id));
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const job = rows[0];
  return NextResponse.json({
    id: job.id,
    projectId: job.projectId,
    type: job.type,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}
