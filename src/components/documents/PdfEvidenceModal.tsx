'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EvidenceLocator } from '@/lib/convex';

type PdfEvidenceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  excerpt: string;
  fileUrl: string | null;
  locator: EvidenceLocator | null;
};

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ── Client-side excerpt search ──────────────────────────────────────────

type TextItemWithPos = {
  str: string;
  width: number;
  height: number;
  transform: number[];
};

function normalizeText(s: string) {
  return s
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, '') // strip double quotes (smart + straight)
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'") // normalize single quotes to apostrophe
    .replace(/[\u2013\u2014]/g, '-') // normalize en/em dash to hyphen
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractItemBounds(item: TextItemWithPos, viewportHeight: number) {
  const [, , , d, e, f] = item.transform;
  const height = Math.abs(d) || item.height || 0;
  const width = item.width || 0;
  return { x: e, y: viewportHeight - f - height, width, height };
}

async function findExcerptInPdf(
  pdf: pdfjs.PDFDocumentProxy,
  excerpt: string,
): Promise<EvidenceLocator | null> {
  const needle = normalizeText(excerpt);
  if (!needle) return null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    let page, viewport, textContent;
    try {
      page = await pdf.getPage(pageNum);
      viewport = page.getViewport({ scale: 1 });
      textContent = await page.getTextContent();
    } catch {
      // PDF proxy was destroyed (e.g. component re-rendered) — bail out
      return null;
    }
    const items: TextItemWithPos[] = [];
    for (const raw of textContent.items) {
      if ('str' in raw) items.push(raw as unknown as TextItemWithPos);
    }
    if (items.length === 0) continue;

    // Join all text items with a single space separator
    const rawText = items.map((it) => it.str).join(' ');

    // Build a char-to-item-index mapping for the raw joined string
    const charToItem: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i > 0) charToItem.push(-1); // the space separator
      for (let c = 0; c < items[i].str.length; c++) {
        charToItem.push(i);
      }
    }

    // Build normalized string AND mapping in one pass (mirrors normalizeText exactly)
    const normChars: { ch: string; rawIdx: number }[] = [];
    let lastWasSpace = false;
    for (let i = 0; i < rawText.length; i++) {
      let ch = rawText[i];

      // Strip double quotes (same chars as normalizeText)
      if (/[\u201C\u201D\u201E\u201F\u2033\u2036"]/.test(ch)) continue;
      // Normalize single quotes to apostrophe
      if (/[\u2018\u2019\u201A\u201B\u2032\u2035']/.test(ch)) ch = "'";
      // Normalize en/em dash to hyphen
      if (/[\u2013\u2014]/.test(ch)) ch = '-';

      const isSpace = /\s/.test(ch);
      if (isSpace) {
        if (!lastWasSpace && normChars.length > 0) {
          normChars.push({ ch: ' ', rawIdx: i });
        }
        lastWasSpace = true;
      } else {
        normChars.push({ ch: ch.toLowerCase(), rawIdx: i });
        lastWasSpace = false;
      }
    }
    // Trim leading/trailing spaces
    while (normChars.length > 0 && normChars[0].ch === ' ') normChars.shift();
    while (normChars.length > 0 && normChars[normChars.length - 1].ch === ' ') normChars.pop();

    const normalizedStr = normChars.map((nc) => nc.ch).join('');
    const matchIdx = normalizedStr.indexOf(needle);
    if (matchIdx === -1) continue;

    // Collect item indices covered by the match
    const hitItems = new Set<number>();
    for (let ni = matchIdx; ni < matchIdx + needle.length; ni++) {
      const rawIdx = normChars[ni]?.rawIdx;
      if (rawIdx == null) continue;
      const itemIdx = charToItem[rawIdx];
      if (itemIdx != null && itemIdx >= 0) hitItems.add(itemIdx);
    }

    const boxes = [...hitItems]
      .sort((a, b) => a - b)
      .map((idx) => extractItemBounds(items[idx]!, viewport.height))
      .filter((b) => b.width > 0 && b.height > 0);

    if (boxes.length === 0) continue;

    return { page: pageNum, text: excerpt, boxes };
  }

  return null;
}

// ── Component ───────────────────────────────────────────────────────────

export function PdfEvidenceModal({
  open,
  onOpenChange,
  title,
  excerpt,
  fileUrl,
  locator,
}: PdfEvidenceModalProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [pageNativeWidth, setPageNativeWidth] = useState(612);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeLocator, setActiveLocator] = useState<EvidenceLocator | null>(null);
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const renderWidth = Math.max(300, containerWidth - 48);
  const scale = pageNativeWidth > 0 ? renderWidth / pageNativeWidth : 1;

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset when modal opens with new content
  useEffect(() => {
    if (open) {
      setLoadError(null);
      setActiveLocator(null);
      setNumPages(null);
      pdfRef.current = null;
    }
  }, [open, fileUrl, excerpt]);

  // ── Core: find excerpt and navigate ──
  useEffect(() => {
    if (!open) return;

    // Pre-computed locator from DB
    if (locator) {
      setActiveLocator(locator);
      setCurrentPage(locator.page);
      return;
    }

    const pdf = pdfRef.current;
    if (!pdf || !excerpt) return;

    let cancelled = false;
    findExcerptInPdf(pdf, excerpt)
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setActiveLocator(found);
          setCurrentPage(found.page);
        } else {
          setCurrentPage(1);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn('[PdfEvidence] Search error:', err);
      });

    return () => { cancelled = true; };
  }, [open, locator, excerpt, numPages]);

  // Scroll highlight into view
  useEffect(() => {
    if (!open || !activeLocator || currentPage !== activeLocator.page) return;
    const timeout = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 600);
    return () => clearTimeout(timeout);
  }, [open, activeLocator, currentPage]);

  const highlightBoxes = useMemo(() => {
    if (!activeLocator || currentPage !== activeLocator.page) return [];
    const boxes = activeLocator.boxes.map((box) => ({
      left: `${box.x * scale}px`,
      top: `${box.y * scale}px`,
      width: `${box.width * scale}px`,
      height: `${box.height * scale}px`,
    }));
    return boxes;
  }, [activeLocator, scale, currentPage, pageNativeWidth, renderWidth]);

  const onPageRenderSuccess = useCallback(
    (page: { originalWidth?: number; width: number; height: number }) => {
      const native = page.originalWidth ?? page.width;
      if (native > 0) setPageNativeWidth(native);
    },
    [],
  );

  const onDocumentLoadSuccess = useCallback(
    (pdf: pdfjs.PDFDocumentProxy) => {
      pdfRef.current = pdf;
      setLoadError(null);
      setNumPages(pdf.numPages);
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-[92vw] h-[85vh] p-0 overflow-hidden flex flex-col"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-sm font-semibold truncate">
              {title}
            </DialogTitle>
            {numPages && numPages > 1 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2 py-0.5 text-xs rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-default"
                >
                  ‹
                </button>
                <span className="text-xs text-muted-foreground tabular-nums min-w-[4rem] text-center">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  className="px-2 py-0.5 text-xs rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-default"
                >
                  ›
                </button>
                {activeLocator && currentPage !== activeLocator.page && (
                  <button
                    onClick={() => setCurrentPage(activeLocator.page)}
                    className="ml-1 px-2 py-0.5 text-xs rounded border border-primary/40 text-primary hover:bg-primary/10"
                  >
                    Go to highlight
                  </button>
                )}
              </div>
            )}
          </div>
          {excerpt ? (
            <DialogDescription className="text-xs italic leading-relaxed line-clamp-2 mt-1">
              &ldquo;{excerpt}&rdquo;
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              PDF evidence viewer
            </DialogDescription>
          )}
        </DialogHeader>

        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-auto bg-muted/30"
        >
          <div className="flex justify-center px-6 py-4">
            {fileUrl ? (
              <Document
                file={fileUrl}
                loading={
                  <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                    Loading PDF…
                  </div>
                }
                error={
                  <div className="flex items-center justify-center py-20 text-sm text-red-400">
                    {loadError ?? 'Failed to load PDF.'}
                  </div>
                }
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error('[PdfEvidence] Load error:', error);
                  setLoadError(error?.message ?? 'Failed to load PDF');
                }}
              >
                <div className="relative inline-block">
                  <Page
                    pageNumber={currentPage}
                    width={renderWidth}
                    renderAnnotationLayer={false}
                    onRenderSuccess={onPageRenderSuccess}
                  />
                  {highlightBoxes.map((style, index) => (
                    <div
                      key={index}
                      ref={index === 0 ? highlightRef : undefined}
                      className="absolute z-10 rounded-sm bg-yellow-300/40 pointer-events-none"
                      style={style}
                    />
                  ))}
                </div>
              </Document>
            ) : (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                No PDF file available.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
