import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api, type Id } from '@/lib/convex';
import { writeFile, mkdir } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import OpenAI from 'openai';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const convex = getConvexClient();

  // Validate project exists
  const project = await convex.query(api.projects.get, {
    id: projectId as Id<"projects">,
  });
  if (!project) {
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

  // Save file to disk
  const uploadDir = path.join(process.cwd(), 'uploads', projectId);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, file.name);
  await writeFile(filePath, buffer);

  // Upload to OpenAI Files API
  let openaiFileId: string | undefined;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const openaiFile = await openai.files.create({
      file: createReadStream(filePath),
      purpose: 'assistants',
    });
    openaiFileId = openaiFile.id;
  } catch (err) {
    console.error('OpenAI file upload failed:', err);
  }

  // Create document record in Convex
  const docId = await convex.mutation(api.documents.create, {
    projectId: projectId as Id<"projects">,
    filename: file.name,
    status: 'uploaded',
    sizeBytes: file.size,
    ...(openaiFileId ? { openaiFileId } : {}),
  });

  return NextResponse.json({
    id: docId,
    filename: file.name,
    sizeBytes: file.size,
    status: 'uploaded',
    openaiFileId,
  });
}
