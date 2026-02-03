import { db } from '@/lib/db';
import { nodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { openai } from './client';

export async function generateEmbeddings(projectId: string) {
  const projectNodes = await db
    .select({ id: nodes.id, label: nodes.label, summary: nodes.summary })
    .from(nodes)
    .where(eq(nodes.projectId, projectId));

  if (projectNodes.length === 0) return;

  const texts = projectNodes.map((n) => `${n.label}: ${n.summary}`);

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
  });

  for (let i = 0; i < projectNodes.length; i++) {
    const vector = response.data[i].embedding;
    await db
      .update(nodes)
      .set({ embedding: JSON.stringify(vector) })
      .where(eq(nodes.id, projectNodes[i].id));
  }
}
