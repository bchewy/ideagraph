import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  label: text('label').notNull(),
  summary: text('summary').notNull(),
  tags: text('tags').notNull().default('[]'),
  embedding: text('embedding'),
  createdAt: integer('created_at').notNull(),
});

export const edges = sqliteTable('edges', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  sourceNodeId: text('source_node_id')
    .notNull()
    .references(() => nodes.id),
  targetNodeId: text('target_node_id')
    .notNull()
    .references(() => nodes.id),
  type: text('type').notNull(),
  confidence: real('confidence').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const evidenceRefs = sqliteTable('evidence_refs', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').references(() => nodes.id),
  edgeId: text('edge_id').references(() => edges.id),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id),
  excerpt: text('excerpt').notNull(),
  locator: text('locator'),
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});
