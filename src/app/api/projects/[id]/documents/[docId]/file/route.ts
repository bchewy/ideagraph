import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api, type Id } from '@/lib/convex';
import { readFile } from 'fs/promises';
import path from 'path';

function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: projectId, docId } = await params;
  const convex = getConvexClient();
  const doc = await convex.query(api.documents.getPublic, {
    id: docId as Id<'documents'>,
  });

  if (!doc || doc.projectId !== projectId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'uploads', projectId, doc.filename);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.byteLength.toString(),
    },
  });
}
