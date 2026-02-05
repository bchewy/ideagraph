import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import DOMMatrix from 'dommatrix';
import { readFile } from 'fs/promises';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { api, type Id } from '@/lib/convex';

type EvidenceLocator = {
  page: number;
  text: string;
  boxes: Array<{ x: number; y: number; width: number; height: number }>;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPageTextMap(textItems: Array<{ str: string }>, mode: 'strict' | 'loose') {
  const text = textItems.map((item) => item.str).join(' ');
  const normalizedChars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isSpace = /\s/.test(ch);
    const isKeep = mode === 'strict' ? true : /[a-z0-9\s]/i.test(ch);
    if (!isKeep) continue;
    if (isSpace) {
      if (!lastWasSpace) {
        normalizedChars.push(' ');
        map.push(i);
      }
      lastWasSpace = true;
    } else {
      normalizedChars.push(ch.toLowerCase());
      map.push(i);
      lastWasSpace = false;
    }
  }
  const rawNormalized = normalizedChars.join('');
  const trimmedStart = rawNormalized.length - rawNormalized.trimStart().length;
  const trimmedEnd = rawNormalized.length - rawNormalized.trimEnd().length;
  const normalized = rawNormalized.slice(trimmedStart, rawNormalized.length - trimmedEnd);
  return { text, normalized, map, offset: trimmedStart };
}

function extractItemBounds(
  item: { width: number; height: number; transform: number[] },
  viewport: { height: number }
) {
  const [, , , d, e, f] = item.transform;
  const height = Math.abs(d) || item.height || 0;
  const width = item.width || 0;
  const x = e;
  const y = viewport.height - f - height;
  return { x, y, width, height };
}

function buildLocator(
  pageNumber: number,
  excerpt: string,
  textItems: Array<{ str: string; width: number; height: number; transform: number[] }>,
  viewport: { height: number }
): EvidenceLocator | null {
  if (!excerpt) return null;
  const normalizedExcerpt = normalizeText(excerpt);
  if (!normalizedExcerpt) return null;
  const strictMap = buildPageTextMap(textItems, 'strict');
  const strictIndex = strictMap.normalized.indexOf(normalizedExcerpt);
  let start = strictIndex;
  let effectiveMap = strictMap.map;
  let effectiveOffset = strictMap.offset;
  let usedLoose = false;
  if (start === -1) {
    const looseExcerpt = normalizeLoose(excerpt);
    const looseMap = buildPageTextMap(textItems, 'loose');
    start = looseMap.normalized.indexOf(looseExcerpt);
    if (start === -1) return null;
    effectiveMap = looseMap.map;
    effectiveOffset = looseMap.offset;
    usedLoose = true;
  }
  const matchLength = usedLoose ? normalizeLoose(excerpt).length : normalizedExcerpt.length;
  const end = start + matchLength - 1;
  const startRaw = start + effectiveOffset;
  const endRaw = end + effectiveOffset;
  const originalStart = effectiveMap[Math.min(startRaw, effectiveMap.length - 1)] ?? 0;
  const originalEnd = effectiveMap[Math.min(endRaw, effectiveMap.length - 1)] ?? strictMap.text.length - 1;
  const prefix = strictMap.text.slice(0, originalStart + 1);
  const rangeText = strictMap.text.slice(originalStart, originalEnd + 1);
  const prefixItems = prefix.trim().split(/\s+/).filter(Boolean).length;
  const rangeItems = rangeText.trim().split(/\s+/).filter(Boolean).length;
  const startIndex = Math.max(0, prefixItems - 1);
  const endIndex = Math.min(textItems.length - 1, startIndex + Math.max(0, rangeItems - 1));
  if (!textItems[startIndex] || !textItems[endIndex]) return null;
  const boxes = textItems
    .slice(startIndex, endIndex + 1)
    .map((item) => extractItemBounds(item, viewport))
    .filter((box) => box.width > 0 && box.height > 0);
  if (boxes.length === 0) return null;
  return { page: pageNumber, text: excerpt, boxes };
}

async function buildPdfLocatorsFromBuffer(buffer: Uint8Array, excerpts: string[]) {
  if (!(globalThis as Record<string, unknown>).DOMMatrix) {
    (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
  }
  const pdf = await getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const locatorMap = new Map<string, EvidenceLocator>();
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{
      str: string;
      width: number;
      height: number;
      transform: number[];
    }>;
    for (const excerpt of excerpts) {
      if (locatorMap.has(excerpt)) continue;
      const locator = buildLocator(pageNumber, excerpt, items, viewport);
      if (locator) locatorMap.set(excerpt, locator);
    }
    if (locatorMap.size === excerpts.length) break;
  }
  return locatorMap;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);
  const documents = await convex.query(api.documents.list, {
    projectId: projectId as Id<'projects'>,
  });

  let updated = 0;

  for (const doc of documents) {
    if (!doc.openaiFileId) continue;
    const refs = await convex.query(api.extraction.listNodeEvidenceByDocument, {
      documentId: doc._id,
    });
    const missing = refs.filter((ref: { locator?: string }) => !ref.locator);
    if (missing.length === 0) continue;

    let buffer: Uint8Array | null = null;
    try {
      // Sanitize filename to prevent path traversal (defense in depth)
      const sanitizedFilename = path.basename(doc.filename);
      const uploadPath = path.join(process.cwd(), 'uploads', projectId, sanitizedFilename);
      const fileBuffer = await readFile(uploadPath);
      buffer = Uint8Array.from(fileBuffer);
    } catch {
      buffer = null;
    }

    if (!buffer) {
      return NextResponse.json({ error: `Missing local file for ${doc.filename}` }, { status: 400 });
    }

    const locatorMap = await buildPdfLocatorsFromBuffer(
      buffer,
      missing.map((ref: { excerpt: string }) => ref.excerpt)
    );

    for (const ref of missing as Array<{ _id: Id<'evidenceRefs'>; excerpt: string }>) {
      const locator = locatorMap.get(ref.excerpt);
      if (!locator) continue;
      await convex.mutation(api.extraction.patchEvidenceLocatorPublic, {
        id: ref._id,
        locator: JSON.stringify(locator),
      });
      updated += 1;
    }
  }

  return NextResponse.json({ updated });
}
