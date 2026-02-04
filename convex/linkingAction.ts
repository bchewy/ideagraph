"use node";

import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Id } from "./_generated/dataModel";

// --- Helpers ---

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// --- Zod schemas ---

const EdgeTypeEnum = z.enum([
  "supports",
  "contradicts",
  "extends",
  "similar",
  "example_of",
  "depends_on",
]);

const ClassifiedEdge = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  type: EdgeTypeEnum,
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
  reasoning: z.string(),
});

const ClassificationResult = z.object({
  edges: z.array(ClassifiedEdge),
});

// --- Constants ---

const BATCH_SIZE = 20;

// --- Setup action: generates embeddings, finds pairs, schedules batch processing ---

export const run = internalAction({
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
      progressMessage: "Clearing previous links…",
      linksCreated: 0,
    });

    try {
      // Clear existing edges
      const cleared = await ctx.runMutation(internal.linking.clearEdges, {
        projectId,
      });

      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressMessage:
          cleared > 0
            ? `Removed ${cleared} old link${cleared === 1 ? "" : "s"}. Loading ideas…`
            : "Loading ideas…",
      });

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Step 1: Get all nodes
      const nodes = await ctx.runQuery(internal.linking.getNodes, {
        projectId,
      });
      if (nodes.length < 2) {
        await ctx.runMutation(internal.jobs.updateProgress, {
          id: jobId,
          progressMessage: `Only ${nodes.length} idea${nodes.length === 1 ? "" : "s"} found — need at least 2 to link`,
        });
        await ctx.runMutation(internal.jobs.markCompleted, { id: jobId });
        return;
      }

      // Step 2: Generate embeddings
      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressMessage: `Generating embeddings for ${nodes.length} ideas…`,
      });

      const texts = nodes.map((n) => `${n.label}: ${n.summary}`);
      const embResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: texts,
      });

      // Save embeddings
      const embUpdates = nodes.map((node, i) => ({
        id: node._id,
        embedding: embResponse.data[i].embedding,
      }));
      await ctx.runMutation(internal.linking.saveEmbeddings, {
        updates: embUpdates,
      });

      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressMessage: `Embeddings ready. Comparing ${nodes.length} ideas for similarity…`,
      });

      // Step 3: Build nodes with embeddings
      interface NodeWithEmbedding {
        id: Id<"nodes">;
        label: string;
        summary: string;
        embedding: number[];
      }

      const nodesWithEmb: NodeWithEmbedding[] = nodes.map((node, i) => ({
        id: node._id,
        label: node.label,
        summary: node.summary,
        embedding: embResponse.data[i].embedding,
      }));

      // Step 4: Deduplicate (>= 0.88 similarity)
      const merged = new Set<string>();
      for (let i = 0; i < nodesWithEmb.length; i++) {
        if (merged.has(nodesWithEmb[i].id)) continue;
        for (let j = i + 1; j < nodesWithEmb.length; j++) {
          if (merged.has(nodesWithEmb[j].id)) continue;
          const sim = cosineSimilarity(
            nodesWithEmb[i].embedding,
            nodesWithEmb[j].embedding
          );
          if (sim >= 0.88) {
            merged.add(nodesWithEmb[j].id);
            await ctx.runMutation(internal.linking.deleteNode, {
              id: nodesWithEmb[j].id,
            });
          }
        }
      }
      const deduplicated = nodesWithEmb.filter((n) => !merged.has(n.id));

      if (merged.size > 0) {
        await ctx.runMutation(internal.jobs.updateProgress, {
          id: jobId,
          progressMessage: `Removed ${merged.size} duplicate idea${merged.size === 1 ? "" : "s"}. ${deduplicated.length} unique ideas remaining.`,
        });
      }

      // Step 5: Find candidate pairs (> 0.4 similarity) and assign batch indices
      interface CandidatePair {
        sourceId: Id<"nodes">;
        targetId: Id<"nodes">;
        similarity: number;
      }

      const pairs: CandidatePair[] = [];
      for (let i = 0; i < deduplicated.length; i++) {
        for (let j = i + 1; j < deduplicated.length; j++) {
          const sim = cosineSimilarity(
            deduplicated[i].embedding,
            deduplicated[j].embedding
          );
          if (sim > 0.4) {
            pairs.push({
              sourceId: deduplicated[i].id,
              targetId: deduplicated[j].id,
              similarity: sim,
            });
          }
        }
      }
      pairs.sort((a, b) => b.similarity - a.similarity);

      if (pairs.length === 0) {
        await ctx.runMutation(internal.jobs.updateProgress, {
          id: jobId,
          progressMessage: `No related pairs found among ${deduplicated.length} ideas`,
        });
        await ctx.runMutation(internal.jobs.markCompleted, { id: jobId });
        return;
      }

      // Step 6: Store pairs in database with batch indices
      const totalBatches = Math.ceil(pairs.length / BATCH_SIZE);
      const pairsToStore = pairs.map((pair, idx) => ({
        jobId,
        sourceNodeId: pair.sourceId,
        targetNodeId: pair.targetId,
        similarity: pair.similarity,
        batchIndex: Math.floor(idx / BATCH_SIZE),
      }));

      await ctx.runMutation(internal.linking.saveLinkingPairs, {
        pairs: pairsToStore,
      });

      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressCurrent: 0,
        progressTotal: totalBatches,
        progressMessage: `Found ${pairs.length} candidate pair${pairs.length === 1 ? "" : "s"}. Classifying in ${totalBatches} batch${totalBatches === 1 ? "" : "es"}…`,
      });

      // Schedule first batch
      await ctx.scheduler.runAfter(0, internal.linkingAction.processBatch, {
        jobId,
        projectId,
        batchIndex: 0,
        totalBatches,
        linksCreated: 0,
        nodeCount: deduplicated.length,
        duplicatesRemoved: merged.size,
      });
    } catch (err) {
      await ctx.runMutation(internal.jobs.markFailed, {
        id: jobId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});

// --- Batch processing action: processes one batch, schedules next ---

export const processBatch = internalAction({
  args: {
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    batchIndex: v.number(),
    totalBatches: v.number(),
    linksCreated: v.number(),
    nodeCount: v.number(),
    duplicatesRemoved: v.number(),
  },
  handler: async (
    ctx,
    { jobId, projectId, batchIndex, totalBatches, linksCreated, nodeCount, duplicatesRemoved }
  ) => {
    try {
      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressCurrent: batchIndex,
        progressMessage: `Classifying batch ${batchIndex + 1} of ${totalBatches}…`,
      });

      // Get pairs for this batch
      const pairs = await ctx.runQuery(internal.linking.getPairsForBatch, {
        jobId,
        batchIndex,
      });

      if (pairs.length === 0) {
        // No pairs in this batch, move to next or finish
        if (batchIndex + 1 < totalBatches) {
          await ctx.scheduler.runAfter(0, internal.linkingAction.processBatch, {
            jobId,
            projectId,
            batchIndex: batchIndex + 1,
            totalBatches,
            linksCreated,
            nodeCount,
            duplicatesRemoved,
          });
        } else {
          await finishJob(ctx, jobId, linksCreated, nodeCount, duplicatesRemoved);
        }
        return;
      }

      // Get node details for classification
      const allNodes = await ctx.runQuery(internal.linking.getNodes, {
        projectId,
      });
      const nodeMap = new Map(
        allNodes.map((n) => [n._id as string, { label: n.label, summary: n.summary }])
      );

      const pairsDescription = pairs
        .map((pair) => {
          const source = nodeMap.get(pair.sourceNodeId as string);
          const target = nodeMap.get(pair.targetNodeId as string);
          if (!source || !target) return null;
          return `- Pair: "${source.label}" (ID: ${pair.sourceNodeId}) ↔ "${target.label}" (ID: ${pair.targetNodeId})\n  Source summary: ${source.summary}\n  Target summary: ${target.summary}\n  Cosine similarity: ${pair.similarity.toFixed(3)}`;
        })
        .filter(Boolean)
        .join("\n\n");

      if (!pairsDescription) {
        if (batchIndex + 1 < totalBatches) {
          await ctx.scheduler.runAfter(0, internal.linkingAction.processBatch, {
            jobId,
            projectId,
            batchIndex: batchIndex + 1,
            totalBatches,
            linksCreated,
            nodeCount,
            duplicatesRemoved,
          });
        } else {
          await finishJob(ctx, jobId, linksCreated, nodeCount, duplicatesRemoved);
        }
        return;
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const classifyResponse = await openai.responses.parse({
        model: "gpt-5.2",
        instructions: `You are an expert knowledge analyst. Given pairs of ideas extracted from documents, classify the relationship between each pair.

For each pair, determine:
- type: one of "supports", "contradicts", "extends", "similar", "example_of", "depends_on"
- confidence: a value between 0 and 1 indicating how confident you are in the relationship
- evidence: a short quote-level justification (<= 1 sentence)
- reasoning: a concise, explicit rationale for the relationship (1-3 sentences)

Only include pairs where you can identify a meaningful relationship with reasonable confidence (>= 0.5).
Use the exact sourceId and targetId values provided.

Relationship type definitions:
- supports: one idea provides evidence or backing for the other
- contradicts: the ideas are in tension or disagreement
- extends: one idea builds upon or elaborates the other
- similar: the ideas cover similar ground but from different angles
- example_of: one idea is a concrete instance of the other
- depends_on: one idea requires or presupposes the other`,
        input: [
          {
            role: "user",
            content: `Classify the relationships between these idea pairs:\n\n${pairsDescription}`,
          },
        ],
        text: {
          format: zodTextFormat(ClassificationResult, "classification_result"),
        },
      });

      const parsed = classifyResponse.output_parsed;
      let batchLinksCreated = 0;

      if (parsed) {
        const validIds = new Set(
          pairs.flatMap((p) => [p.sourceNodeId as string, p.targetNodeId as string])
        );

        for (const edge of parsed.edges) {
          if (!validIds.has(edge.sourceId) || !validIds.has(edge.targetId))
            continue;
          if (edge.confidence < 0.5) continue;

          // Get evidence document ID
          const evidenceRefs = await ctx.runQuery(
            internal.linking.getNodeEvidence,
            { nodeId: edge.sourceId as Id<"nodes"> }
          );
          const documentId = evidenceRefs[0]?.documentId;
          const evidenceLocator = evidenceRefs[0]?.locator;

          await ctx.runMutation(internal.linking.saveEdge, {
            projectId,
            sourceNodeId: edge.sourceId as Id<"nodes">,
            targetNodeId: edge.targetId as Id<"nodes">,
            type: edge.type,
            confidence: edge.confidence,
            reasoning: edge.reasoning,
            evidenceDocumentId: documentId,
            evidenceExcerpt: documentId ? edge.evidence : undefined,
            evidenceLocator: evidenceLocator,
          });
          batchLinksCreated++;
        }
      }

      const totalLinksCreated = linksCreated + batchLinksCreated;

      await ctx.runMutation(internal.jobs.updateProgress, {
        id: jobId,
        progressCurrent: batchIndex + 1,
        linksCreated: totalLinksCreated,
        progressMessage:
          batchIndex + 1 < totalBatches
            ? `Batch ${batchIndex + 1} done — ${totalLinksCreated} link${totalLinksCreated === 1 ? "" : "s"} created so far…`
            : `All batches complete`,
      });

      // Schedule next batch or finish
      if (batchIndex + 1 < totalBatches) {
        await ctx.scheduler.runAfter(0, internal.linkingAction.processBatch, {
          jobId,
          projectId,
          batchIndex: batchIndex + 1,
          totalBatches,
          linksCreated: totalLinksCreated,
          nodeCount,
          duplicatesRemoved,
        });
      } else {
        await finishJob(ctx, jobId, totalLinksCreated, nodeCount, duplicatesRemoved);
      }
    } catch (err) {
      await ctx.runMutation(internal.jobs.markFailed, {
        id: jobId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});

// Helper to finish the job and clean up
async function finishJob(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  linksCreated: number,
  nodeCount: number,
  duplicatesRemoved: number
) {
  // Clean up temporary pairs
  await ctx.runMutation(internal.linking.clearLinkingPairs, { jobId });

  // Final summary
  const parts: string[] = [
    `Done — created ${linksCreated} link${linksCreated === 1 ? "" : "s"} between ${nodeCount} ideas`,
  ];
  if (duplicatesRemoved > 0) {
    parts.push(`removed ${duplicatesRemoved} duplicate${duplicatesRemoved === 1 ? "" : "s"}`);
  }
  await ctx.runMutation(internal.jobs.updateProgress, {
    id: jobId,
    linksCreated,
    progressMessage: parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(", ")})` : parts[0],
  });
  await ctx.runMutation(internal.jobs.markCompleted, { id: jobId });
}
