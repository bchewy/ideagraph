import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
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

export const startLocatorBackfill = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const jobId = await ctx.db.insert("jobs", {
      projectId,
      type: "locator_backfill",
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.extractionAction.backfillLocators, {
      jobId,
      projectId,
    });

    return jobId;
  },
});

export const listNodeEvidenceByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const refs = await ctx.db
      .query("evidenceRefs")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();
    return refs.filter((ref) => ref.nodeId);
  },
});

export const patchEvidenceLocatorPublic = mutation({
  args: {
    id: v.id("evidenceRefs"),
    locator: v.string(),
  },
  handler: async (ctx, { id, locator }) => {
    await ctx.db.patch(id, { locator });
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
        locators: v.optional(v.array(v.union(v.string(), v.null()))),
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
      for (let index = 0; index < idea.excerpts.length; index++) {
        const excerpt = idea.excerpts[index];
        const normalized = normalizeExcerpt(excerpt);
        if (normalized.length < minLength || normalized.length > maxLength) {
          continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const locator = idea.locators?.[index] ?? undefined;
        await ctx.db.insert("evidenceRefs", {
          nodeId,
          documentId,
          excerpt: normalized,
          ...(locator ? { locator } : {}),
        });
      }
    }
  },
});

export const getEvidenceByDocument = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    return await ctx.db
      .query("evidenceRefs")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();
  },
});

export const patchEvidenceLocator = internalMutation({
  args: {
    id: v.id("evidenceRefs"),
    locator: v.string(),
  },
  handler: async (ctx, { id, locator }) => {
    await ctx.db.patch(id, { locator });
  },
});
