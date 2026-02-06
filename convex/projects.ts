import {
  query,
  mutation,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db.insert("projects", { name });
  },
});

// Delete all projects and cascade-clean their data
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    for (const project of projects) {
      await ctx.db.delete(project._id);
      await ctx.scheduler.runAfter(0, internal.projects.performDelete, {
        projectId: project._id,
      });
    }
  },
});

// Delete the project record immediately, then clean up related data in batches
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    await ctx.scheduler.runAfter(0, internal.projects.performDelete, {
      projectId: id,
    });
  },
});

// Action that loops deleteBatch until everything is cleaned up
export const performDelete = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    let hasMore = true;
    while (hasMore) {
      hasMore = await ctx.runMutation(internal.projects.deleteBatch, {
        projectId,
      });
    }
  },
});

// Delete a small batch of related records per call (stays within read limits)
export const deleteBatch = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }): Promise<boolean> => {
    // 1. Edges + their evidence refs (50 at a time)
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(50);
    if (edges.length > 0) {
      for (const edge of edges) {
        const refs = await ctx.db
          .query("evidenceRefs")
          .withIndex("by_edge", (q) => q.eq("edgeId", edge._id))
          .collect();
        for (const ref of refs) await ctx.db.delete(ref._id);
        await ctx.db.delete(edge._id);
      }
      return true;
    }

    // 2. Nodes + their evidence refs (50 at a time)
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(50);
    if (nodes.length > 0) {
      for (const node of nodes) {
        const refs = await ctx.db
          .query("evidenceRefs")
          .withIndex("by_node", (q) => q.eq("nodeId", node._id))
          .collect();
        for (const ref of refs) await ctx.db.delete(ref._id);
        await ctx.db.delete(node._id);
      }
      return true;
    }

    // 3. Documents (200 at a time)
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(200);
    if (docs.length > 0) {
      for (const doc of docs) await ctx.db.delete(doc._id);
      return true;
    }

    // 4. Jobs (200 at a time)
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(200);
    if (jobs.length > 0) {
      for (const job of jobs) await ctx.db.delete(job._id);
      return true;
    }

    return false; // all clean
  },
});
