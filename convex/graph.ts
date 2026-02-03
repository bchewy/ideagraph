import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) return null;

    // Get all nodes
    const allNodes = await ctx.db
      .query("nodes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Get evidence for each node
    const graphNodes = await Promise.all(
      allNodes.map(async (node) => {
        const refs = await ctx.db
          .query("evidenceRefs")
          .withIndex("by_node", (q) => q.eq("nodeId", node._id))
          .collect();

        const sources = await Promise.all(
          refs.map(async (ref) => {
            const doc = await ctx.db.get(ref.documentId);
            return {
              documentId: ref.documentId as string,
              filename: doc?.filename ?? "Unknown",
              excerpt: ref.excerpt,
            };
          })
        );

        return {
          id: node._id as string,
          label: node.label,
          summary: node.summary,
          tags: node.tags,
          sources,
          documentId: (sources[0]?.documentId) as string | undefined,
        };
      })
    );

    // Get all edges
    const allEdges = await ctx.db
      .query("edges")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const graphEdges = await Promise.all(
      allEdges.map(async (edge) => {
        const refs = await ctx.db
          .query("evidenceRefs")
          .withIndex("by_edge", (q) => q.eq("edgeId", edge._id))
          .collect();

        const evidence = await Promise.all(
          refs.map(async (ref) => {
            const doc = await ctx.db.get(ref.documentId);
            return {
              documentId: ref.documentId as string,
              filename: doc?.filename ?? "Unknown",
              excerpt: ref.excerpt,
            };
          })
        );

        return {
          id: edge._id as string,
          source: edge.sourceNodeId as string,
          target: edge.targetNodeId as string,
          type: edge.type,
          confidence: edge.confidence,
          evidence,
        };
      })
    );

    return { nodes: graphNodes, edges: graphEdges };
  },
});
