import { db } from '@/lib/db';
import { nodes, edges, evidenceRefs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { openai } from './client';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { randomUUID } from 'crypto';

export interface CandidatePair {
  sourceId: string;
  targetId: string;
  similarity: number;
}

interface NodeWithEmbedding {
  id: string;
  label: string;
  summary: string;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

async function deduplicateNodes(
  nodesWithEmbeddings: NodeWithEmbedding[],
  threshold: number
): Promise<NodeWithEmbedding[]> {
  const merged = new Set<string>();

  for (let i = 0; i < nodesWithEmbeddings.length; i++) {
    if (merged.has(nodesWithEmbeddings[i].id)) continue;
    for (let j = i + 1; j < nodesWithEmbeddings.length; j++) {
      if (merged.has(nodesWithEmbeddings[j].id)) continue;
      const sim = cosineSimilarity(
        nodesWithEmbeddings[i].embedding,
        nodesWithEmbeddings[j].embedding
      );
      if (sim >= threshold) {
        merged.add(nodesWithEmbeddings[j].id);
        await db.delete(nodes).where(eq(nodes.id, nodesWithEmbeddings[j].id));
      }
    }
  }

  return nodesWithEmbeddings.filter((n) => !merged.has(n.id));
}

export async function getCandidatePairs(
  projectId: string
): Promise<CandidatePair[]> {
  const projectNodes = await db
    .select({
      id: nodes.id,
      label: nodes.label,
      summary: nodes.summary,
      embedding: nodes.embedding,
    })
    .from(nodes)
    .where(eq(nodes.projectId, projectId));

  const withEmbeddings: NodeWithEmbedding[] = projectNodes
    .filter((n) => n.embedding !== null)
    .map((n) => ({
      id: n.id,
      label: n.label,
      summary: n.summary,
      embedding: JSON.parse(n.embedding!) as number[],
    }));

  if (withEmbeddings.length < 2) return [];

  const deduplicated = await deduplicateNodes(withEmbeddings, 0.88);

  const pairs: CandidatePair[] = [];
  for (let i = 0; i < deduplicated.length; i++) {
    for (let j = i + 1; j < deduplicated.length; j++) {
      const similarity = cosineSimilarity(
        deduplicated[i].embedding,
        deduplicated[j].embedding
      );
      if (similarity > 0.4) {
        pairs.push({
          sourceId: deduplicated[i].id,
          targetId: deduplicated[j].id,
          similarity,
        });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

const EdgeTypeEnum = z.enum([
  'supports',
  'contradicts',
  'extends',
  'similar',
  'example_of',
  'depends_on',
]);

const ClassifiedEdge = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  type: EdgeTypeEnum,
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});

const ClassificationResult = z.object({
  edges: z.array(ClassifiedEdge),
});

const BATCH_SIZE = 20;

export async function classifyRelationships(
  projectId: string,
  candidatePairs: CandidatePair[]
): Promise<void> {
  if (candidatePairs.length === 0) return;

  const projectNodes = await db
    .select({ id: nodes.id, label: nodes.label, summary: nodes.summary })
    .from(nodes)
    .where(eq(nodes.projectId, projectId));

  const nodeMap = new Map(projectNodes.map((n) => [n.id, n]));

  for (let i = 0; i < candidatePairs.length; i += BATCH_SIZE) {
    const batch = candidatePairs.slice(i, i + BATCH_SIZE);

    const pairsDescription = batch
      .map((pair) => {
        const source = nodeMap.get(pair.sourceId);
        const target = nodeMap.get(pair.targetId);
        if (!source || !target) return null;
        return `- Pair: "${source.label}" (ID: ${pair.sourceId}) ↔ "${target.label}" (ID: ${pair.targetId})\n  Source summary: ${source.summary}\n  Target summary: ${target.summary}\n  Cosine similarity: ${pair.similarity.toFixed(3)}`;
      })
      .filter(Boolean)
      .join('\n\n');

    if (!pairsDescription) continue;

    const response = await openai.responses.parse({
      model: 'gpt-4.1',
      instructions: `You are an expert knowledge analyst. Given pairs of ideas extracted from documents, classify the relationship between each pair.

For each pair, determine:
- type: one of "supports", "contradicts", "extends", "similar", "example_of", "depends_on"
- confidence: a value between 0 and 1 indicating how confident you are in the relationship
- evidence: a brief explanation of why this relationship exists

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
          role: 'user',
          content: `Classify the relationships between these idea pairs:\n\n${pairsDescription}`,
        },
      ],
      text: {
        format: zodTextFormat(ClassificationResult, 'classification_result'),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) continue;

    const now = Math.floor(Date.now() / 1000);
    const validSourceIds = new Set(batch.map((p) => p.sourceId));
    const validTargetIds = new Set(batch.map((p) => p.targetId));

    for (const edge of parsed.edges) {
      if (!validSourceIds.has(edge.sourceId) && !validTargetIds.has(edge.sourceId)) continue;
      if (!validTargetIds.has(edge.targetId) && !validSourceIds.has(edge.targetId)) continue;
      if (edge.confidence < 0.5) continue;

      const edgeId = randomUUID();
      await db.insert(edges).values({
        id: edgeId,
        projectId,
        sourceNodeId: edge.sourceId,
        targetNodeId: edge.targetId,
        type: edge.type,
        confidence: edge.confidence,
        createdAt: now,
      });

      const docIds = await db
        .select({ documentId: evidenceRefs.documentId })
        .from(evidenceRefs)
        .where(eq(evidenceRefs.nodeId, edge.sourceId));
      const documentId = docIds[0]?.documentId;

      if (documentId) {
        await db.insert(evidenceRefs).values({
          id: randomUUID(),
          edgeId,
          documentId,
          excerpt: edge.evidence,
        });
      }
    }
  }
}
