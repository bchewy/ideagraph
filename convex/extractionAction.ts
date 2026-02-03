"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const IdeaSchema = z.object({
  label: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  excerpts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const ExtractionResult = z.object({
  documentSummary: z.string(),
  ideas: z.array(IdeaSchema).max(30),
});

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
          instructions: `You are an expert knowledge analyst. Extract the key ideas from the provided PDF document.

First, write a one-paragraph summary of the entire document.

For each idea, provide:
- label: A concise title (5-10 words)
- summary: A 1-2 sentence explanation
- tags: 2-5 relevant topic tags
- excerpts: 1-2 direct quotes from the document that support this idea
- confidence: A number between 0 and 1 indicating how well the excerpts support the idea

Extract up to 30 ideas. Focus on the most important and distinct concepts.`,
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

          await ctx.runMutation(internal.jobs.updateProgress, {
            id: jobId,
            progressMessage: `Saving ${parsed.ideas.length} ideas from "${doc.filename}"…`,
            ideasExtracted: totalIdeas,
          });

          await ctx.runMutation(internal.extraction.saveIdeas, {
            projectId,
            documentId: docId,
            documentSummary: parsed.documentSummary,
            ideas: parsed.ideas,
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
