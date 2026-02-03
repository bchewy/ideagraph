import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are accepted' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds 50MB limit' },
      { status: 400 }
    );
  }

  const uploadDir = path.join(process.cwd(), 'uploads', projectId);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, file.name);
  await writeFile(filePath, buffer);

  const docId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(documents).values({
    id: docId,
    projectId,
    filename: file.name,
    status: 'uploaded',
    sizeBytes: file.size,
    createdAt: now,
  });

  return NextResponse.json({
    id: docId,
    filename: file.name,
    sizeBytes: file.size,
    status: 'uploaded',
  });
}
