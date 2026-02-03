import { db } from '@/lib/db';
import { nodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
