# AGENTS.md

## Project Overview
- IdeaGraph is a knowledge graph app that extracts ideas from PDFs using OpenAI and visualizes them in an interactive graph with evidence attribution.
- Stack: Next.js 16 App Router (TypeScript strict), Tailwind CSS 4 + shadcn/ui, Convex backend, React Flow visualization, pdfjs-dist + react-pdf for PDF processing.

## Key Directories
- `src/app` — Next.js App Router routes, layouts, API routes, and ConvexClientProvider.
- `src/components/graph` — GraphCanvas (React Flow), IdeaNode, RelationshipEdge, DocumentGroup, FilterPanel, ExportButton.
- `src/components/inspector` — NodeInspector (resizable, with connection filtering), EdgeInspector.
- `src/components/documents` — Sidebar (upload/extract/link controls), UploadDropzone, DocumentList, PdfEvidenceModal.
- `src/components/onboarding` — OnboardingDialog (5-step guided tour).
- `src/components/ui` — shadcn/ui primitives (button, card, dialog, input, badge).
- `src/lib` — Convex API re-exports, `cn()` utility, `EvidenceLocator` type.
- `src/lib/graph` — Document-grouped grid layout algorithm.
- `convex` — Schema, queries, mutations, actions (extraction, linking, jobs, graph, projects, documents).
- `remotion` — Promo video scenes and composition (dev dependency only).
- `public` — Static assets.
- `uploads` — Local PDF uploads (dev only; gitignored).

## Build and Test Commands
- `npm run dev` — Start Next.js dev server.
- `npx convex dev` — Start Convex dev sync (run in parallel).
- `npm run build` — Production build.
- `npm run typecheck` — TypeScript type checking.
- `npm run lint` — ESLint.
- `npm run remotion:studio` — Open Remotion video editor.

No test framework is configured. Use `typecheck` and `lint` to validate changes.

## Local Development Setup
- Create `.env.local` from `.env.local.example` with required keys (OPENAI_API_KEY, CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL).
- Start `npx convex dev` before running `npm run dev` so mutations/actions can run.
- Keep local PDFs in `uploads/`; they should remain gitignored.

## Code Style Guidelines
- Follow existing file structure and naming patterns.
- Use the project's lint/format setup (ESLint + Tailwind conventions).
- Prefer small, focused changes; place new modules alongside related code.
- For Convex functions, keep query/mutation/action names descriptive and colocate helpers in `convex/`.
- For UI, prefer composing existing shadcn/ui primitives over new bespoke components.
- Dark mode is always-on (`className="dark"` on root layout). Do not add light mode support.

## Testing Instructions
- Run the smallest relevant check first (`typecheck`/`lint`) before full builds.
- For UI changes, verify the affected page locally with `npm run dev`.
- For Convex changes, verify in the Convex dashboard logs or local terminal output.

## Security Considerations
- Do not commit secrets. Use `.env.local` and update `.env.local.example` when adding new vars.
- Keep API keys only in Convex env (`npx convex env set`).
- Redact any sample PDFs or user data before sharing outside the repo.
- Do not store raw PDFs in Convex; store derived metadata or extracted nodes only.
- PDF uploads are validated with magic bytes (`%PDF`), MIME type check, 50MB limit, and `path.basename()` sanitization.
- Security headers are set in `next.config.ts` (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, strict Referrer-Policy, restrictive Permissions-Policy).

## Commit and PR Guidelines
- Use Conventional Commits when creating commits (e.g., `feat:`, `fix:`, `chore:`).
- PRs should include a summary, testing notes, and screenshots for UI changes.

## Architecture Overview

### Convex Function Pattern
Mutation → scheduler → action for long-running work:
1. Public mutation creates a `jobs` record and schedules an internal action.
2. Internal action (in a separate `"use node"` file) runs in Node.js, calls OpenAI, writes results via internal mutations.
3. Frontend subscribes to job status reactively via `useQuery`.

Function pairs:
- `convex/extraction.ts` (mutations) + `convex/extractionAction.ts` (action)
- `convex/linking.ts` (mutations) + `convex/linkingAction.ts` (action)

### Component Hierarchy
```
RootLayout (dark mode, Geist fonts, MobileBlocker, ConvexClientProvider)
├── Home page — project list, CreateProjectDialog, DeleteProjectButton
└── Workspace (projects/[id])
    └── WorkspaceClient
        ├── Sidebar — OnboardingButton, UploadDropzone, DocumentList, extract/link/backfill controls
        ├── FilterPanel + ExportButton
        ├── GraphCanvas — ReactFlow with IdeaNode, RelationshipEdge, DocumentGroup
        ├── NodeInspector or EdgeInspector (right panel, conditional)
        └── PdfEvidenceModal (dynamic import, renders PDF with highlighted evidence)
```

### Database Schema (7 tables)
`projects`, `documents`, `nodes`, `edges`, `evidenceRefs`, `jobs`, `linkingPairs`. All main tables indexed by `projectId`. Evidence refs link nodes/edges to source documents (many-to-many). Jobs track async work with progress fields and 15-min stale timeout. linkingPairs stores temporary similarity pairs during batch classification.

## Implementation Notes
- Graph data is normalized in Convex; React Flow state is derived from `api.graph.get` query — never duplicated in client state.
- PDF processing runs in Convex actions (server-side) using OpenAI. Client only uploads and subscribes to job status.
- Idea extraction uses GPT-5.2 with Zod Structured Outputs (max 30 ideas/doc, includes confidence score and evidence excerpts).
- Evidence excerpts are filtered (40–500 chars) and case-insensitive deduped in `convex/extraction.ts`.
- PDF locators (page number + word-level bounding boxes) are built during extraction using pdfjs-dist. Falls back to OpenAI Files API if local file unavailable.
- Locator backfill can retroactively build locators for evidence refs missing them, using two-pass text matching (strict normalization, then loose alphanumeric-only fallback).
- Post-extraction node dedup uses text-embedding-3-large embeddings in `convex/linkingAction.ts` (cosine similarity >= 0.88 deletes duplicates).
- Relationship linking batches candidate pairs (similarity > 0.4) into groups of 20 for GPT classification. Each batch is scheduled via `ctx.scheduler` to avoid timeout.
- Project deletion cascades via an internal action that loops batch mutations (50 edges/nodes, 200 docs/jobs per batch).
- Extraction completion automatically triggers linking once per session (via `useRef` guard in Sidebar).
- Focus mode: double-clicking a node highlights its connections and fades unrelated nodes to 6% opacity.
- NodeInspector supports resizing (280–600px drag handle) and inline connection filtering by relationship type and min confidence.
- PdfEvidenceModal uses server-provided locators when available; otherwise performs client-side text search with character-level bounding box extraction.
