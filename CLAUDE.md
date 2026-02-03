# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IdeaGraph is a knowledge graph application that extracts ideas from PDFs using OpenAI's GPT and visualizes them as an interactive graph. Users upload PDFs, ideas are extracted and linked via embeddings + GPT classification, and the resulting graph is displayed on a React Flow canvas with evidence attribution.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Database:** SQLite via Drizzle ORM (better-sqlite3)
- **AI:** OpenAI SDK — GPT-5.2 (Structured Outputs), text-embedding-3-large
- **Graph:** React Flow (visualization), Dagre (layout)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # TypeScript type checking (npx tsc --noEmit)
npm run lint         # ESLint
```

## Architecture

### Processing Pipeline

1. **Upload** — PDFs saved to `uploads/{projectId}/` and uploaded to OpenAI Files API
2. **Extract** — GPT-5.2 with Structured Outputs extracts ideas (max 30 per doc) → creates nodes + evidenceRefs
3. **Link** — Generate embeddings → cosine similarity pairs (>0.4 threshold, deduplicate ≥0.88) → GPT classifies relationships → creates edges
4. All long-running operations use a job-based async pattern: endpoint returns `{ jobId }`, frontend polls `/api/jobs/[id]` every 2s

### Key Paths

- `src/lib/db/schema.ts` — Drizzle schema (projects, documents, nodes, edges, evidenceRefs, jobs)
- `src/lib/db/index.ts` — Database connection
- `src/lib/openai/client.ts` — OpenAI client
- `src/lib/openai/extract.ts` — Idea extraction pipeline
- `src/lib/openai/embeddings.ts` — Embedding generation
- `src/lib/openai/link.ts` — Relationship classification
- `src/lib/graph/layout.ts` — Dagre layout
- `src/components/graph/` — GraphCanvas, IdeaNode, RelationshipEdge
- `src/components/inspector/` — NodeInspector, EdgeInspector
- `src/components/documents/` — DocumentList, UploadDropzone

### API Routes

- `POST /api/projects/[id]/upload` — Multipart PDF upload
- `POST /api/projects/[id]/extract` — Trigger idea extraction (returns jobId)
- `POST /api/projects/[id]/link` — Trigger relationship linking (returns jobId)
- `GET /api/projects/[id]/graph` — Fetch full graph (nodes + edges + evidence)
- `GET /api/jobs/[id]` — Poll job status

### Database Schema

Six tables: `projects`, `documents`, `nodes`, `edges`, `evidenceRefs`, `jobs`. All IDs are text (UUIDs). Timestamps are integers (Unix epoch). Tags and embeddings stored as JSON text in SQLite.

### Edge Types

`supports`, `contradicts`, `extends`, `similar`, `example_of`, `depends_on` — color-coded in the UI.

## Environment

Requires `OPENAI_API_KEY` in `.env.local`. See `.env.local.example`.

## Ralph Agent System

This repo uses an autonomous agent loop (`ralph.sh`) that implements user stories from `tasks.json` one at a time. Progress is tracked in `progress.txt`. Read the Codebase Patterns section at the top of `progress.txt` before starting work.
