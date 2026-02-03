import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Public mutation — creates a job and schedules the extraction action
export const start = mutation({
  args: {
    projectId: v.id("projects"),
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, { projectId, documentIds }) => {
    const jobId = await ctx.db.insert("jobs", {
      projectId,
      type: "extraction",
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.extractionAction.run, {
      jobId,
      projectId,
      documentIds,
    });

    return jobId;
  },
});

// Internal mutation to batch-save extracted ideas
export const saveIdeas = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    documentSummary: v.string(),
    ideas: v.array(
      v.object({
        label: v.string(),
        summary: v.string(),
        tags: v.array(v.string()),
        excerpts: v.array(v.string()),
        confidence: v.number(),
      })
    ),
  },
  handler: async (ctx, { projectId, documentId, documentSummary, ideas }) => {
    await ctx.db.patch(documentId, { summary: documentSummary });
    const normalizeExcerpt = (value: string) =>
      value.replace(/\s+/g, " ").trim();
    const minLength = 40;
    const maxLength = 500;
    for (const idea of ideas) {
      const nodeId = await ctx.db.insert("nodes", {
        projectId,
        label: idea.label,
        summary: idea.summary,
        tags: idea.tags,
        confidence: idea.confidence,
      });
      const seen = new Set<string>();
      for (const excerpt of idea.excerpts) {
        const normalized = normalizeExcerpt(excerpt);
        if (normalized.length < minLength || normalized.length > maxLength) {
          continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        await ctx.db.insert("evidenceRefs", {
          nodeId,
          documentId,
          excerpt: normalized,
        });
      }
    }
  },
});
