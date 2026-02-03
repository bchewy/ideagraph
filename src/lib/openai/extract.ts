import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function extractIdeas(
  _projectId: string,
  documentIds: string[]
) {
  for (const docId of documentIds) {
    await db
      .update(documents)
      .set({ status: 'extracting' })
      .where(eq(documents.id, docId));
  }

  // TODO (US-013): Implement actual GPT extraction with Structured Outputs

  for (const docId of documentIds) {
    await db
      .update(documents)
      .set({ status: 'extracted' })
      .where(eq(documents.id, docId));
  }
}
