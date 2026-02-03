import {
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// --- Public mutation ---

export const start = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const jobId = await ctx.db.insert("jobs", {
      projectId,
      type: "linking",
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.linkingAction.run, {
      jobId,
      projectId,
    });

    return jobId;
  },
});

// --- Internal queries ---

export const getNodes = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("nodes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getNodeEvidence = internalQuery({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    return await ctx.db
      .query("evidenceRefs")
      .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
      .collect();
  },
});

// --- Internal mutations ---

export const saveEmbeddings = internalMutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("nodes"),
        embedding: v.array(v.float64()),
      })
    ),
  },
  handler: async (ctx, { updates }) => {
    for (const { id, embedding } of updates) {
      await ctx.db.patch(id, { embedding });
    }
  },
});

export const deleteNode = internalMutation({
  args: { id: v.id("nodes") },
  handler: async (ctx, { id }) => {
    const refs = await ctx.db
      .query("evidenceRefs")
      .withIndex("by_node", (q) => q.eq("nodeId", id))
      .collect();
    for (const ref of refs) await ctx.db.delete(ref._id);
    await ctx.db.delete(id);
  },
});

export const clearEdges = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const edge of edges) {
      // Delete evidenceRefs tied to this edge
      const refs = await ctx.db
        .query("evidenceRefs")
        .withIndex("by_edge", (q) => q.eq("edgeId", edge._id))
        .collect();
      for (const ref of refs) await ctx.db.delete(ref._id);
      await ctx.db.delete(edge._id);
    }

    return edges.length;
  },
});

export const saveEdge = internalMutation({
  args: {
    projectId: v.id("projects"),
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
    type: v.string(),
    confidence: v.number(),
    evidenceDocumentId: v.optional(v.id("documents")),
    evidenceExcerpt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const edgeId = await ctx.db.insert("edges", {
      projectId: args.projectId,
      sourceNodeId: args.sourceNodeId,
      targetNodeId: args.targetNodeId,
      type: args.type,
      confidence: args.confidence,
    });

    if (args.evidenceDocumentId && args.evidenceExcerpt) {
      await ctx.db.insert("evidenceRefs", {
        edgeId,
        documentId: args.evidenceDocumentId,
        excerpt: args.evidenceExcerpt,
      });
    }
  },
});

export const saveLinkingPairs = internalMutation({
  args: {
    pairs: v.array(
      v.object({
        jobId: v.id("jobs"),
        sourceNodeId: v.id("nodes"),
        targetNodeId: v.id("nodes"),
        similarity: v.number(),
        batchIndex: v.number(),
      })
    ),
  },
  handler: async (ctx, { pairs }) => {
    for (const pair of pairs) {
      await ctx.db.insert("linkingPairs", pair);
    }
  },
});

export const getPairsForBatch = internalQuery({
  args: {
    jobId: v.id("jobs"),
    batchIndex: v.number(),
  },
  handler: async (ctx, { jobId, batchIndex }) => {
    return await ctx.db
      .query("linkingPairs")
      .withIndex("by_job_batch", (q) =>
        q.eq("jobId", jobId).eq("batchIndex", batchIndex)
      )
      .collect();
  },
});

export const clearLinkingPairs = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const pairs = await ctx.db
      .query("linkingPairs")
      .withIndex("by_job_batch", (q) => q.eq("jobId", jobId))
      .collect();
    for (const pair of pairs) {
      await ctx.db.delete(pair._id);
    }
  },
});
