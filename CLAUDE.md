# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IdeaGraph is a knowledge graph application that extracts ideas from PDFs using OpenAI's GPT and visualizes them as an interactive graph. Users upload PDFs, ideas are extracted and linked via embeddings + GPT classification, and the resulting graph is displayed on a React Flow canvas with evidence attribution. Evidence excerpts can be highlighted in-place within a PDF viewer.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript (strict mode)
- **UI:** Tailwind CSS 4 + shadcn/ui (New York style, Lucide icons)
- **Database:** Convex (cloud backend + reactive database)
- **AI:** OpenAI SDK — GPT-5.2 (Structured Outputs via Zod), text-embedding-3-large
- **Graph:** React Flow (`@xyflow/react`) with custom document-grouped grid layout
- **PDF:** pdfjs-dist (text extraction + bounding boxes), react-pdf (viewer + highlighting)
- **Video:** Remotion (promo video generation, dev dependency only)
- **Path alias:** `@/*` maps to `./src/*`

## Commands

```bash
npm run dev              # Start Next.js dev server
npx convex dev           # Start Convex dev sync (run in separate terminal)
npm run build            # Production build
npm run typecheck        # TypeScript type checking (npx tsc --noEmit)
npm run lint             # ESLint
npm run remotion:studio  # Open Remotion video editor
npm run remotion:render  # Render promo video (landscape)
```

No test framework is configured. Use `typecheck` and `lint` to validate changes.

## Architecture

### Convex Function Pattern

The codebase follows a strict mutation → scheduler → action pattern for long-running work:

1. **Public mutation** creates a `jobs` record and schedules an action via `ctx.scheduler.runAfter(0, internal.<actionFile>.run, args)`
2. **Internal action** (in a separate `"use node"` file) runs in Node.js runtime, calls OpenAI, and writes results back through internal mutations
3. **Frontend** subscribes to job status reactively via `useQuery` — no polling

This pattern is used because Convex actions cannot write to the database directly; they must call `ctx.runMutation()`. Each action file starts with the `"use node"` directive to access Node.js APIs (OpenAI SDK, etc.).

Function pairs:
- `convex/extraction.ts` (mutations) + `convex/extractionAction.ts` (action)
- `convex/linking.ts` (mutations) + `convex/linkingAction.ts` (action)

### Processing Pipeline

1. **Upload** — PDF saved to `uploads/{projectId}/`, uploaded to OpenAI Files API, document record created in Convex
2. **Extract** — GPT-5.2 with Structured Outputs extracts ideas (max 30 per doc) → creates nodes + evidenceRefs. Evidence excerpts are filtered (40–500 chars) and case-insensitive deduped. PDF locators (page + bounding boxes) are built for each excerpt using pdfjs-dist.
3. **Link** — Generates embeddings → cosine similarity pairs (>0.4 threshold) → deduplicates nodes (≥0.88 similarity) → GPT classifies relationships in batches of 20 → creates edges. Batches are processed sequentially via scheduler to avoid timeouts.
4. **Locator Backfill** — Retroactively builds PDF locators for evidence refs missing them. Uses two-pass text matching (strict normalization, then loose alphanumeric-only fallback).

### Key Paths

- `convex/schema.ts` — Database schema (7 tables: projects, documents, nodes, edges, evidenceRefs, jobs, linkingPairs)
- `convex/extraction.ts` + `convex/extractionAction.ts` — Idea extraction pipeline + PDF locator building
- `convex/linking.ts` + `convex/linkingAction.ts` — Relationship linking pipeline (embeddings, dedup, batch classification)
- `convex/jobs.ts` — Job status tracking with automatic 15-min stale timeout
- `convex/graph.ts` — Full graph export query (resolves all nodes, edges, and evidence)
- `convex/projects.ts` — Project CRUD + cascading batch deletion (edges → nodes → docs → jobs)
- `src/components/WorkspaceClient.tsx` — Main workspace layout (sidebar, canvas, inspectors, evidence modal)
- `src/components/graph/GraphCanvas.tsx` — React Flow integration with filtering, search, and focus mode
- `src/components/graph/` — IdeaNode, RelationshipEdge, DocumentGroup, FilterPanel, ExportButton
- `src/components/inspector/` — NodeInspector (resizable, with connection filtering), EdgeInspector
- `src/components/documents/Sidebar.tsx` — Upload, extraction, linking controls with progress indicators
- `src/components/documents/PdfEvidenceModal.tsx` — PDF viewer with highlighted evidence excerpts
- `src/components/onboarding/OnboardingDialog.tsx` — 5-step guided tour
- `src/lib/graph/layout.ts` — Document-grouped grid layout (client-side)
- `src/lib/convex.ts` — Convex API re-exports + `EvidenceLocator` type

### API Routes

- `POST /api/projects/[id]/upload` — Multipart PDF upload (validates PDF magic bytes, 50MB limit, sanitizes filenames). Uploads to OpenAI Files API and creates Convex document record.
- `GET /api/projects/[id]/documents/[docId]/file` — Serves uploaded PDF files from disk
- `POST /api/projects/[id]/backfill-locators` — Builds PDF page/bounding-box locators for evidence refs missing them. Uses pdfjs-dist with two-pass text matching.

All other data operations use Convex functions directly from the frontend via `useQuery`/`useMutation`.

### Database Schema (Convex)

Seven tables: `projects`, `documents`, `nodes`, `edges`, `evidenceRefs`, `jobs`, `linkingPairs`. IDs are Convex-generated (`Id<"tableName">`). Timestamps use `_creationTime` (auto). Tags and embeddings are native arrays (`v.array(v.string())`, `v.array(v.float64())`).

Key indexes: all main tables indexed by `projectId`; evidenceRefs indexed by `nodeId`, `edgeId`, `documentId`; jobs use compound index `by_project_type`; linkingPairs use `by_job_batch`.

### Edge Types

`supports`, `contradicts`, `extends`, `similar`, `example_of`, `depends_on` — color-coded in the UI.

### Graph Features

- **Focus mode** — Double-click a node to highlight its connections; non-connected nodes fade to 6% opacity
- **Search** — Real-time case-insensitive filtering by label and tags
- **Filtering** — By document, edge type, and minimum confidence (via FilterPanel)
- **Export** — Download entire graph as JSON
- **Auto-linking** — Extraction completion automatically triggers linking (once per session)

### Project Deletion

Cascade deletion uses an internal action that loops a batch mutation (50 edges/nodes, 200 docs/jobs per batch) to stay within Convex limits. Deletes in order: edges + evidence → nodes + evidence → documents → jobs.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`)
- **Convex functions:** Keep public queries/mutations in one file, Node.js actions in a paired `*Action.ts` file with `"use node"` directive
- **UI:** Compose existing shadcn/ui primitives; avoid new bespoke components
- **React Flow state:** Derived from Convex data — don't duplicate source-of-truth in client state
- **Dark mode only:** Always-on via `className="dark"` on root layout
- **Desktop only:** MobileBlocker component prevents mobile/tablet access

## Environment

Requires in `.env.local`:
- `OPENAI_API_KEY` — for upload route and Convex actions
- `CONVEX_DEPLOYMENT` — set by `npx convex dev`
- `NEXT_PUBLIC_CONVEX_URL` — set by `npx convex dev`

Also set in Convex cloud: `npx convex env set OPENAI_API_KEY <key>`

## Production Deployment

Docker multi-stage build (Node.js 24 Alpine) with Next.js standalone output. Runs as unprivileged user. Uses external Traefik reverse proxy with automatic HTTPS (Let's Encrypt). Uploads persist via Docker volume. Security headers configured in `next.config.ts` (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, strict Referrer-Policy, restrictive Permissions-Policy). Config in `docker-compose.yml`.
