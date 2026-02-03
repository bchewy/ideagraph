import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  filename: text('filename').notNull(),
  openaiFileId: text('openai_file_id'),
  status: text('status').notNull().default('pending'),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: integer('created_at').notNull(),
});
