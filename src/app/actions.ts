'use server';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

export async function getProjects() {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProject(id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  return rows[0] ?? null;
}

export async function createProject(name: string) {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(projects).values({ id, name, createdAt: now });
  revalidatePath('/');
  return { id };
}
