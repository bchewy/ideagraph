# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IdeaGraph is a knowledge graph application that extracts ideas from PDFs using OpenAI's GPT and visualizes them as an interactive graph. Users upload PDFs, ideas are extracted and linked via embeddings + GPT classification, and the resulting graph is displayed on a React Flow canvas with evidence attribution.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Database:** Convex (cloud backend + reactive database)
- **AI:** OpenAI SDK — GPT-4.1 (Structured Outputs), text-embedding-3-large
- **Graph:** React Flow (visualization), custom grid layout

## Commands

```bash
npm run dev          # Start Next.js dev server
npx convex dev       # Start Convex dev sync (run in parallel)
npm run build        # Production build
npm run typecheck    # TypeScript type checking (npx tsc --noEmit)
npm run lint         # ESLint
```

## Architecture

### Processing Pipeline

1. **Upload** — PDFs saved to `uploads/{projectId}/` and uploaded to OpenAI Files API (Next.js API route → Convex mutation)
2. **Extract** — Convex action calls GPT-4.1 with Structured Outputs to extract ideas (max 30 per doc) → creates nodes + evidenceRefs
3. **Link** — Convex action generates embeddings → cosine similarity pairs (>0.4 threshold, deduplicate ≥0.88) → GPT classifies relationships → creates edges
4. Long-running operations use Convex's mutation → scheduler → action pattern. Frontend subscribes to job status reactively via `useQuery` (no polling).

### Key Paths

- `convex/schema.ts` — Convex schema (projects, documents, nodes, edges, evidenceRefs, jobs)
- `convex/projects.ts` — Project CRUD (queries + mutations)
- `convex/documents.ts` — Document queries + mutations
- `convex/graph.ts` — Graph data query (nodes + edges + evidence)
- `convex/jobs.ts` — Job status query + internal mutations
- `convex/extraction.ts` — Idea extraction (mutation + Node.js action calling OpenAI)
- `convex/linking.ts` — Relationship linking (mutation + Node.js action calling OpenAI)
- `src/lib/convex.ts` — Re-exports `api` and types from Convex generated code
- `src/lib/graph/layout.ts` — Document-grouped grid layout (runs client-side)
- `src/app/ConvexClientProvider.tsx` — Convex React provider
- `src/components/graph/` — GraphCanvas, IdeaNode, RelationshipEdge
- `src/components/inspector/` — NodeInspector, EdgeInspector
- `src/components/documents/` — DocumentList, UploadDropzone, Sidebar

### API Routes

- `POST /api/projects/[id]/upload` — Multipart PDF upload (only remaining Next.js API route)

All other data operations use Convex functions directly from the frontend via `useQuery`/`useMutation`.

### Database Schema (Convex)

Six tables: `projects`, `documents`, `nodes`, `edges`, `evidenceRefs`, `jobs`. IDs are Convex-generated (`Id<"tableName">`). Timestamps use `_creationTime` (auto). Tags are native `string[]`, embeddings are native `float64[]`.

### Edge Types

`supports`, `contradicts`, `extends`, `similar`, `example_of`, `depends_on` — color-coded in the UI.

## Environment

Requires in `.env.local`:
- `OPENAI_API_KEY` — for upload route and Convex actions
- `CONVEX_DEPLOYMENT` — set by `npx convex dev`
- `NEXT_PUBLIC_CONVEX_URL` — set by `npx convex dev`

Also set in Convex cloud: `npx convex env set OPENAI_API_KEY <key>`

See `.env.local.example`.
