import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
  }),

  documents: defineTable({
    projectId: v.id("projects"),
    filename: v.string(),
    openaiFileId: v.optional(v.string()),
    status: v.string(),
    sizeBytes: v.number(),
    summary: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  nodes: defineTable({
    projectId: v.id("projects"),
    label: v.string(),
    summary: v.string(),
    tags: v.array(v.string()),
    confidence: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())),
  }).index("by_project", ["projectId"]),

  edges: defineTable({
    projectId: v.id("projects"),
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
    type: v.string(),
    confidence: v.number(),
  }).index("by_project", ["projectId"]),

  evidenceRefs: defineTable({
    nodeId: v.optional(v.id("nodes")),
    edgeId: v.optional(v.id("edges")),
    documentId: v.id("documents"),
    excerpt: v.string(),
    locator: v.optional(v.string()),
  })
    .index("by_node", ["nodeId"])
    .index("by_edge", ["edgeId"]),

  jobs: defineTable({
    projectId: v.id("projects"),
    type: v.string(),
    status: v.string(),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    progressCurrent: v.optional(v.number()),
    progressTotal: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    ideasExtracted: v.optional(v.number()),
    linksCreated: v.optional(v.number()),
    lastProgressAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"]),

  linkingPairs: defineTable({
    jobId: v.id("jobs"),
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
    similarity: v.number(),
    batchIndex: v.number(),
  }).index("by_job_batch", ["jobId", "batchIndex"]),
});
