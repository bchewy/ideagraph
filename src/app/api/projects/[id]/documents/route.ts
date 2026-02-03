import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const docs = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      status: documents.status,
      sizeBytes: documents.sizeBytes,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.createdAt));

  return NextResponse.json(docs);
}
