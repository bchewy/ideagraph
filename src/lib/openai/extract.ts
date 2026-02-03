import { db } from '@/lib/db';
import { documents, nodes, evidenceRefs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { openai } from './client';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const IdeaSchema = z.object({
  label: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  excerpts: z.array(z.string()),
});

const ExtractionResult = z.object({
  ideas: z.array(IdeaSchema).max(30),
});

export async function extractIdeas(
  projectId: string,
  documentIds: string[]
) {
  for (const docId of documentIds) {
    await db
      .update(documents)
      .set({ status: 'extracting' })
      .where(eq(documents.id, docId));

    const doc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId));
    if (doc.length === 0) continue;

    const { openaiFileId } = doc[0];
    if (!openaiFileId) {
      await db
        .update(documents)
        .set({ status: 'extracted' })
        .where(eq(documents.id, docId));
      continue;
    }

    const response = await openai.responses.parse({
      model: 'gpt-4.1',
      instructions: `You are an expert knowledge analyst. Extract the key ideas from the provided PDF document.

For each idea, provide:
- label: A concise title (5-10 words)
- summary: A 1-2 sentence explanation
- tags: 2-5 relevant topic tags
- excerpts: 1-2 direct quotes from the document that support this idea

Extract up to 30 ideas. Focus on the most important and distinct concepts.`,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              file_id: openaiFileId,
            },
            {
              type: 'input_text',
              text: 'Extract the key ideas from this document.',
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(ExtractionResult, 'extraction_result'),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) continue;

    const now = Math.floor(Date.now() / 1000);

    for (const idea of parsed.ideas) {
      const nodeId = randomUUID();
      await db.insert(nodes).values({
        id: nodeId,
        projectId,
        label: idea.label,
        summary: idea.summary,
        tags: JSON.stringify(idea.tags),
        createdAt: now,
      });

      for (const excerpt of idea.excerpts) {
        await db.insert(evidenceRefs).values({
          id: randomUUID(),
          nodeId,
          documentId: docId,
          excerpt,
        });
      }
    }

    await db
      .update(documents)
      .set({ status: 'extracted' })
      .where(eq(documents.id, docId));
  }
}
