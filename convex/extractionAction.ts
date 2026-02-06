"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import path from "path";
import { readFile } from "fs/promises";
import DOMMatrix from "dommatrix";

type EvidenceLocator = {
  page: number;
  text: string;
  boxes: Array<{ x: number; y: number; width: number; height: number }>;
};

const IdeaSchema = z.object({
  label: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  excerpts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const ExtractionResult = z.object({
  documentSummary: z.string(),
  ideas: z.array(IdeaSchema).max(15),
});

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPageTextMap(
  textItems: Array<{ str: string }>,
  mode: "strict" | "loose" = "strict"
) {
  const text = textItems.map((item) => item.str).join(" ");
  const normalizedChars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isSpace = /\s/.test(ch);
    const isKeep = mode === "strict" ? true : /[a-z0-9\s]/i.test(ch);
    if (!isKeep) continue;
    if (isSpace) {
      if (!lastWasSpace) {
        normalizedChars.push(" ");
        map.push(i);
      }
      lastWasSpace = true;
    } else {
      normalizedChars.push(ch.toLowerCase());
      map.push(i);
      lastWasSpace = false;
    }
  }
  const rawNormalized = normalizedChars.join("");
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
  const { text, normalized, map, offset } = buildPageTextMap(textItems, "strict");
  const strictIndex = normalized.indexOf(normalizedExcerpt);
  let start = strictIndex;
  let effectiveMap = map;
  let effectiveOffset = offset;
  let usedLoose = false;
  if (start === -1) {
    const looseExcerpt = normalizeLoose(excerpt);
    const looseMapData = buildPageTextMap(textItems, "loose");
    start = looseMapData.normalized.indexOf(looseExcerpt);
    if (start === -1) return null;
    effectiveMap = looseMapData.map;
    effectiveOffset = looseMapData.offset;
    usedLoose = true;
  }
  const matchLength = usedLoose
    ? normalizeLoose(excerpt).length
    : normalizedExcerpt.length;
  const end = start + matchLength - 1;
  const startRaw = start + effectiveOffset;
  const endRaw = end + effectiveOffset;
  const originalStart = effectiveMap[Math.min(startRaw, effectiveMap.length - 1)] ?? 0;
  const originalEnd = effectiveMap[Math.min(endRaw, effectiveMap.length - 1)] ?? text.length - 1;
  const prefix = text.slice(0, originalStart + 1);
  const rangeText = text.slice(originalStart, originalEnd + 1);
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

  return {
    page: pageNumber,
    text: excerpt,
    boxes,
  };
}

async function buildPdfLocatorsFromBuffer(
  buffer: Buffer,
  excerpts: string[]
): Promise<Map<string, EvidenceLocator>> {
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = DOMMatrix;
  }
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: buffer }).promise;
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
      if (locator) {
        locatorMap.set(excerpt, locator);
      }
    }
    if (locatorMap.size === excerpts.length) break;
  }
  return locatorMap;
}

async function getDocumentBuffer(
  filePath: string | null,
  openai: OpenAI,
  openaiFileId: string
): Promise<Buffer> {
  if (filePath) {
    return await readFile(filePath);
  }
  const fileResponse = await openai.files.content(openaiFileId);
  return Buffer.from(await fileResponse.arrayBuffer());
}

async function resolvePdfBuffer(
  filePath: string | null,
  openai: OpenAI,
  openaiFileId: string,
  cache: Map<string, Buffer>
): Promise<Buffer> {
  const cached = cache.get(openaiFileId);
  if (cached) return cached;
  const buffer = await getDocumentBuffer(filePath, openai, openaiFileId);
  cache.set(openaiFileId, buffer);
  return buffer;
}

// Runs in Node.js — calls OpenAI to extract ideas from documents
export const run = internalAction({
  args: {
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, { jobId, projectId, documentIds }) => {
    await ctx.runMutation(internal.jobs.markRunning, { id: jobId });
    await ctx.runMutation(internal.jobs.updateProgress, {
      id: jobId,
      progressCurrent: 0,
      progressTotal: documentIds.length,
      progressMessage: `Preparing to extract ideas from ${documentIds.length} document${documentIds.length === 1 ? "" : "s"}…`,
      ideasExtracted: 0,
    });

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const bufferCache = new Map<string, Buffer>();
      let totalIdeas = 0;

      for (let i = 0; i < documentIds.length; i++) {
        const docId = documentIds[i];
        await ctx.runMutation(internal.documents.updateStatus, {
          id: docId,
          status: "extracting",
        });

        const doc = await ctx.runQuery(internal.documents.get, { id: docId });
        if (!doc?.openaiFileId) {
          await ctx.runMutation(internal.documents.updateStatus, {
            id: docId,
            status: "extracted",
          });
          continue;
        }

        await ctx.runMutation(internal.jobs.updateProgress, {
          id: jobId,
          progressCurrent: i,
          progressMessage: `Reading "${doc.filename}"… (${i + 1} of ${documentIds.length})`,
        });

        const response = await openai.responses.parse({
          model: "gpt-5.2",
          instructions: `You are an expert academic analyst building a knowledge graph. Your job is to extract the genuinely important IDEAS and CLAIMS from a research paper — not every detail.

First, write a one-paragraph summary of the entire document.

Then extract ideas. Be HIGHLY SELECTIVE. A good idea for the knowledge graph is one that:
- Represents a core thesis, novel contribution, key finding, or significant claim
- Could meaningfully connect to ideas in OTHER papers (not just internal details)
- Would be worth debating, building upon, or citing independently
- Is distinct from other ideas you've already extracted (no overlapping concepts)

Do NOT extract:
- Background context or literature review summaries (unless the paper makes a novel claim about them)
- Methodology details that are standard/routine (only extract if the method itself is a contribution)
- Minor observations, caveats, or implementation details
- Restatements of the same idea with different wording
- Future work suggestions (unless they constitute a specific, substantive claim)

Aim for 5-12 ideas for a typical paper. Only reach 15 for exceptionally dense, multi-contribution papers. Quality over quantity — fewer strong ideas make a better graph than many weak ones.

For each idea:
- label: A specific, assertive title (5-10 words) — frame it as a claim, not a topic. "X improves Y by Z" is better than "Discussion of X"
- summary: A 1-2 sentence explanation of the specific claim or contribution
- tags: 2-5 relevant topic tags
- excerpts: 1-2 direct quotes from the document that most strongly support this idea
- confidence: How central this idea is to the paper's contribution (1.0 = core thesis, 0.7+ = significant finding, below 0.5 = probably not worth extracting)`,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_file",
                  file_id: doc.openaiFileId,
                },
                {
                  type: "input_text",
                  text: "Extract the key ideas from this document.",
                },
              ],
            },
          ],
          text: {
            format: zodTextFormat(ExtractionResult, "extraction_result"),
          },
        });

        const parsed = response.output_parsed;
        if (parsed) {
          totalIdeas += parsed.ideas.length;

          // Sanitize filename to prevent path traversal (defense in depth)
          const sanitizedFilename = path.basename(doc.filename);
          const uploadPath = path.join(process.cwd(), "uploads", projectId, sanitizedFilename);
          const allExcerpts = parsed.ideas.flatMap((idea) => idea.excerpts || []);
          let locatorMap = new Map<string, EvidenceLocator>();
          try {
            let filePath: string | null = uploadPath;
            try {
              await readFile(uploadPath);
            } catch {
              filePath = null;
            }
            const buffer = await resolvePdfBuffer(
              filePath,
              openai,
              doc.openaiFileId,
              bufferCache
            );
            locatorMap = await buildPdfLocatorsFromBuffer(buffer, allExcerpts);
          } catch (error) {
            // Log only error message, not full error object (may contain sensitive data)
            console.warn(`Failed to build locators for ${doc.filename}:`, error instanceof Error ? error.message : 'Unknown error');
          }

          await ctx.runMutation(internal.jobs.updateProgress, {
            id: jobId,
            progressMessage: `Saving ${parsed.ideas.length} ideas from "${doc.filename}"…`,
            ideasExtracted: totalIdeas,
          });

          await ctx.runMutation(internal.extraction.saveIdeas, {
            projectId,
            documentId: docId,
            documentSummary: parsed.documentSummary,
            ideas: parsed.ideas.map((idea) => ({
              ...idea,
              locators: idea.excerpts.map((excerpt) => {
                const locator = locatorMap.get(excerpt);
                return locator ? JSON.stringify(locator) : null;
              }),
            })),
          });
        }

        await ctx.runMutation(internal.documents.updateStatus, {
          id: docId,
          status: "extracted",
        });

        await ctx.runMutation(internal.jobs.updateProgress, {
          id: jobId,
          progressCurrent: i + 1,
          progressMessage:
            i + 1 < documentIds.length
              ? `Finished "${doc.filename}" — moving to next document…`
              : `Finished extracting from all documents`,
        });
      }

      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressMessage: `Done — extracted ${totalIdeas} idea${totalIdeas === 1 ? "" : "s"} from ${documentIds.length} document${documentIds.length === 1 ? "" : "s"}`,
      });
      await ctx.runMutation(internal.jobs.markCompleted, { id: jobId });
    } catch (err) {
      await ctx.runMutation(internal.jobs.markFailed, {
        id: jobId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});

export const backfillLocators = internalAction({
  args: {
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { jobId, projectId }) => {
    await ctx.runMutation(internal.jobs.markRunning, { id: jobId });
    await ctx.runMutation(internal.jobs.updateProgress, {
      id: jobId,
      progressCurrent: 0,
      progressTotal: 0,
      progressMessage: "Scanning evidence for missing locators…",
    });

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const bufferCache = new Map<string, Buffer>();

      const docs = await ctx.runQuery(internal.documents.getByProject, {
        projectId,
      });

      const eligibleDocs = docs.filter((doc) => doc.openaiFileId);
      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressTotal: eligibleDocs.length,
        progressMessage: `Processing ${eligibleDocs.length} document${eligibleDocs.length === 1 ? "" : "s"}…`,
      });

      let processed = 0;
      let updated = 0;

      for (const doc of eligibleDocs) {
        const evidenceRefs = await ctx.runQuery(internal.extraction.getEvidenceByDocument, {
          documentId: doc._id,
        });
        const missing = evidenceRefs.filter((ref) => !ref.locator);
        if (missing.length === 0) {
          processed += 1;
          await ctx.runMutation(internal.jobs.updateProgress, {
            id: jobId,
            progressCurrent: processed,
            progressMessage: `No missing locators in ${doc.filename}`,
          });
          continue;
        }

        // Sanitize filename to prevent path traversal (defense in depth)
        const sanitizedFilename = path.basename(doc.filename);
        const uploadPath = path.join(process.cwd(), "uploads", projectId, sanitizedFilename);
        let filePath: string | null = uploadPath;
        try {
          await readFile(uploadPath);
        } catch {
          filePath = null;
        }

        let buffer: Buffer;
        try {
          buffer = await resolvePdfBuffer(
            filePath,
            openai,
            doc.openaiFileId as string,
            bufferCache
          );
        } catch (error) {
          processed += 1;
          await ctx.runMutation(internal.jobs.updateProgress, {
            id: jobId,
            progressCurrent: processed,
            progressMessage: `Failed to fetch ${doc.filename}`,
          });
          // Log only error message, not full error object (may contain sensitive data)
          console.warn(`Failed to fetch PDF for ${doc.filename}:`, error instanceof Error ? error.message : 'Unknown error');
          continue;
        }

        const locatorMap = await buildPdfLocatorsFromBuffer(
          buffer,
          missing.map((ref) => ref.excerpt)
        );

        for (const ref of missing) {
          const locator = locatorMap.get(ref.excerpt);
          if (!locator) continue;
          await ctx.runMutation(internal.extraction.patchEvidenceLocator, {
            id: ref._id,
            locator: JSON.stringify(locator),
          });
          updated += 1;
        }

        processed += 1;
        await ctx.runMutation(internal.jobs.updateProgress, {
          id: jobId,
          progressCurrent: processed,
          progressMessage: `Backfilled ${updated} locator${updated === 1 ? "" : "s"} so far…`,
        });
      }

      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressMessage: `Done — backfilled ${updated} locator${updated === 1 ? "" : "s"} across ${eligibleDocs.length} document${eligibleDocs.length === 1 ? "" : "s"}`,
      });
      await ctx.runMutation(internal.jobs.markCompleted, { id: jobId });
    } catch (err) {
      await ctx.runMutation(internal.jobs.markFailed, {
        id: jobId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});
