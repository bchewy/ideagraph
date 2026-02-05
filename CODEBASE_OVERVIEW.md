# IdeaGraph — Comprehensive Codebase Overview

## What This Is

IdeaGraph is a knowledge graph application that extracts ideas from PDFs using OpenAI's GPT-5.2, links them via embeddings and classification, and visualizes the result as an interactive React Flow canvas. Users upload PDFs, ideas are extracted with evidence attribution, relationships are discovered automatically, and the graph can be explored with filtering, search, focus mode, and in-PDF evidence highlighting.

---

## 1. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React 19 / Next.js 16 App Router)                    │
│                                                                 │
│  / ─────────────── Project list (useQuery → projects.list)      │
│  /projects/[id] ── WorkspaceClient                              │
│    ├── Sidebar ──── Upload, Extract, Link controls              │
│    ├── GraphCanvas ─ React Flow + document-grouped layout       │
│    ├── Inspectors ── Node/Edge detail panels                    │
│    └── PdfModal ──── react-pdf viewer with bounding-box highlights│
│                                                                 │
│  State: Convex reactive queries (useQuery) — no Redux/Zustand   │
│  Mutations: useMutation → Convex public mutations               │
└──────────────┬──────────────────────────────────┬───────────────┘
               │ Convex WebSocket                 │ HTTP (file I/O)
               ▼                                  ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Convex Cloud Backend    │   │  Next.js API Routes              │
│                          │   │                                  │
│  Public queries/mutations│   │  POST /api/projects/[id]/upload  │
│  Internal actions (Node) │   │  GET  /api/.../file              │
│  Scheduler (batch work)  │   │  POST /api/.../backfill-locators │
│  7-table reactive DB     │   │                                  │
└──────────┬───────────────┘   └──────────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  OpenAI API              │
│  GPT-5.2 (extraction +   │
│    relationship classify) │
│  text-embedding-3-large  │
│  Files API (PDF upload)  │
└──────────────────────────┘
```

### Entry Points

| Entry Point | Type | Purpose |
|---|---|---|
| `src/app/page.tsx` | Page | Home — project list, create/delete |
| `src/app/projects/[id]/page.tsx` | Page | Workspace — upload, extract, link, visualize |
| `src/app/api/projects/[id]/upload/route.ts` | API | PDF upload (multipart, 50MB limit, magic bytes validation) |
| `src/app/api/projects/[id]/documents/[docId]/file/route.ts` | API | Serve uploaded PDF from disk |
| `src/app/api/projects/[id]/backfill-locators/route.ts` | API | Build missing PDF bounding-box locators |
| `convex/extraction.ts` | Convex | Extraction mutations (start job, save ideas) |
| `convex/extractionAction.ts` | Convex | GPT-5.2 idea extraction (Node.js runtime) |
| `convex/linking.ts` | Convex | Linking mutations (start job, save edges) |
| `convex/linkingAction.ts` | Convex | Embeddings + batch classification (Node.js runtime) |

### Core Architectural Pattern: Mutation → Scheduler → Action

All long-running work follows this pattern because Convex actions cannot write to the database directly:

```
Frontend calls public mutation
  → Creates job record + schedules internal action via ctx.scheduler.runAfter(0, ...)
    → Internal action (Node.js runtime) calls OpenAI, writes results via ctx.runMutation()
      → Frontend subscribes reactively via useQuery() — no polling needed
```

Function pairs:
- `extraction.ts` (mutations) ↔ `extractionAction.ts` (action)
- `linking.ts` (mutations) ↔ `linkingAction.ts` (action)

### Processing Pipeline

```
Upload PDF → Save to disk + OpenAI Files API → Create document record
     ↓
Extract Ideas → GPT-5.2 Structured Outputs (max 30 ideas/doc)
     │          → Build PDF locators (page + bounding boxes)
     │          → Save nodes + evidenceRefs
     ↓
Link Ideas → Generate embeddings (text-embedding-3-large, 3072 dims)
     │      → Deduplicate nodes (≥ 0.88 cosine similarity)
     │      → Find candidate pairs (> 0.4 similarity)
     │      → GPT-5.2 classifies in batches of 20
     │      → Save edges (confidence ≥ 0.5)
     ↓
Visualize → graph.get reactive query resolves nodes + edges + evidence
          → Document-grouped grid layout (client-side)
          → React Flow with custom IdeaNode / RelationshipEdge components
```

### Component Hierarchy

```
RootLayout (dark mode, Geist fonts, MobileBlocker)
└── ConvexClientProvider
    ├── / (Home)
    │   ├── CreateProjectDialog
    │   └── DeleteProjectButton (per project)
    └── /projects/[id]
        └── WorkspaceClient
            ├── Sidebar
            │   ├── UploadDropzone
            │   ├── DocumentList (status badges per doc)
            │   ├── Extract / Link / Backfill buttons
            │   └── Job progress indicators (reactive)
            ├── GraphCanvas
            │   ├── Search input (case-insensitive label/tag filter)
            │   ├── ReactFlow
            │   │   ├── IdeaNode (custom node)
            │   │   ├── RelationshipEdge (custom edge, color-coded by type)
            │   │   └── DocumentGroup (visual container)
            │   ├── FilterPanel (document, edge type, min confidence)
            │   ├── ExportButton (JSON download)
            │   └── MiniMap + Controls + Background
            ├── NodeInspector (resizable, filterable linked nodes)
            ├── EdgeInspector (type, confidence, reasoning)
            └── PdfEvidenceModal (dynamic import, SSR: false)
                └── react-pdf viewer with bounding-box highlights
```

---

## 2. Database Schema

Seven Convex tables. All IDs are Convex-generated (`Id<"tableName">`). Timestamps use `_creationTime`.

| Table | Key Fields | Indexes | Purpose |
|---|---|---|---|
| **projects** | `name` | — | Root entity |
| **documents** | `projectId`, `filename`, `openaiFileId?`, `status`, `sizeBytes`, `summary?` | `by_project` | Uploaded PDFs |
| **nodes** | `projectId`, `label`, `summary`, `tags[]`, `confidence?`, `embedding?` | `by_project` | Extracted ideas |
| **edges** | `projectId`, `sourceNodeId`, `targetNodeId`, `type`, `confidence`, `reasoning?` | `by_project` | Relationships between ideas |
| **evidenceRefs** | `nodeId?`, `edgeId?`, `documentId`, `excerpt`, `locator?` | `by_node`, `by_edge`, `by_document` | PDF excerpts backing ideas/edges |
| **jobs** | `projectId`, `type`, `status`, `error?`, `progress*`, `lastProgressAt?` | `by_project`, `by_project_type` | Async job tracking (15-min stale timeout) |
| **linkingPairs** | `jobId`, `sourceNodeId`, `targetNodeId`, `similarity`, `batchIndex` | `by_job_batch` | Temporary batch processing storage |

**Edge types:** `supports`, `contradicts`, `extends`, `similar`, `example_of`, `depends_on` — color-coded in the UI.

**Cascade deletion:** Projects delete in batches (50 edges/nodes, 200 docs/jobs per batch) via internal action loop to respect Convex limits.

---

## 3. Key Patterns & Abstractions

### Reactive State (No Redux)

All persistent data flows through Convex reactive queries. The frontend never polls:

```
Convex DB change → useQuery auto-reruns → React re-renders
```

Local React state is used only for UI concerns: sidebar open/closed, selected node/edge, search text, filter settings, inspector width, focus mode.

### Document-Grouped Grid Layout (`src/lib/graph/layout.ts`)

Nodes are arranged by source document in horizontal groups. Groups are sorted largest-first, each laid out as a grid (2–3 columns). Constants: `NODE_WIDTH=220`, `NODE_HEIGHT=70`, `GROUP_GAP=180`.

### Two-Pass PDF Text Matching

Evidence excerpts are matched to PDF pages for bounding-box locators:
1. **Strict pass:** Whitespace normalization + case-insensitive match
2. **Loose pass:** Alphanumeric-only normalization (handles OCR errors, punctuation variants)

### Evidence Excerpt Filtering

Excerpts are kept if 40–500 characters after whitespace normalization. Deduplicated per node via case-insensitive key.

### Batch Processing for Linking

Candidate pairs are stored in `linkingPairs` table, processed in batches of 20 via sequential scheduler calls. Each batch completion schedules the next. This avoids Convex action timeouts.

### Job Stale Timeout

If a job shows no progress for 15 minutes (`lastProgressAt` check), the query returns it as failed. This is checked at read time, not via a background timer.

### Auto-Linking Guard

After extraction completes, the Sidebar auto-triggers linking exactly once per browser session via a `useRef` guard.

---

## 4. Dependencies & Configuration

### Production Dependencies (15 packages)

| Category | Packages |
|---|---|
| Framework | `next@16.1.6`, `react@19.2.3`, `react-dom@19.2.3` (pinned) |
| Backend | `convex@^1.31.7` |
| AI | `openai@^6.17.0` |
| Graph | `@xyflow/react@^12.10.0` |
| PDF | `pdfjs-dist@^5.4.624`, `react-pdf@^10.3.0` |
| Validation | `zod@^4.3.6` |
| UI | `radix-ui@^1.4.3`, `lucide-react@^0.563.0`, `class-variance-authority`, `clsx`, `tailwind-merge` |
| Polyfill | `dommatrix@^0.1.1` (for pdfjs-dist server-side) |

### Dev Dependencies (16 packages)

Tailwind CSS 4, TypeScript 5, ESLint 9, Remotion (5 packages for promo video generation).

### Build Configuration

| File | Key Settings |
|---|---|
| `next.config.ts` | `output: "standalone"`, `serverExternalPackages: ["pdfjs-dist"]`, security headers |
| `tsconfig.json` | `strict: true`, `target: "ES2017"`, `@/*` → `./src/*` |
| `convex/tsconfig.json` | `strict: true`, `target: "ESNext"` |
| `postcss.config.mjs` | `@tailwindcss/postcss` plugin (Tailwind v4) |
| `eslint.config.mjs` | Flat config, Next.js Core Web Vitals + TypeScript presets |

### Environment Variables

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | Server + Convex cloud | Yes | GPT-5.2, embeddings, Files API |
| `NEXT_PUBLIC_CONVEX_URL` | Client + Server | Yes | Convex backend endpoint |
| `CONVEX_DEPLOYMENT` | Server | Yes | Convex deployment identifier |

Convex cloud also needs: `npx convex env set OPENAI_API_KEY <key>`

### Deployment

Docker multi-stage build (Node.js 24 Alpine):
1. `base` → `deps` (npm ci) → `builder` (next build) → `runner` (standalone output)
2. Runs as unprivileged user `nextjs:1001`
3. Traefik reverse proxy with automatic HTTPS (Let's Encrypt)
4. Uploads persist via Docker volume
5. Domain: `ideagraph.bchewy.com`

Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict `Referrer-Policy`, restrictive `Permissions-Policy`.

---

## 5. API Catalog

### Next.js API Routes

**POST `/api/projects/[id]/upload`**
- Multipart form with `file` field
- Validates: PDF MIME type, magic bytes (`%PDF`), 50MB limit, filename sanitization
- Saves to `uploads/{projectId}/{sanitizedFilename}`, uploads to OpenAI Files API
- Returns: `{ id, filename, sizeBytes, status: "uploaded", openaiFileId? }`

**GET `/api/projects/[id]/documents/[docId]/file`**
- Validates document belongs to project
- Returns: PDF bytes with `Content-Type: application/pdf`

**POST `/api/projects/[id]/backfill-locators`**
- Builds missing PDF locators for evidence refs
- Returns: `{ updated: number }`

### Convex Public Functions

**Queries:** `projects.list`, `projects.get`, `documents.list`, `documents.getPublic`, `jobs.get` (with 15-min timeout), `jobs.getLatestByType`, `graph.get` (full graph with resolved evidence), `extraction.listNodeEvidenceByDocument`

**Mutations:** `projects.create`, `projects.remove` (cascade), `documents.create`, `extraction.start`, `extraction.startLocatorBackfill`, `extraction.patchEvidenceLocatorPublic`, `linking.start`

### OpenAI Integration

| Call | Model | Purpose |
|---|---|---|
| `openai.files.create()` | Files API | Upload PDF for GPT processing |
| `openai.responses.parse()` | `gpt-5.2` | Extract ideas with Structured Outputs (Zod) |
| `openai.responses.parse()` | `gpt-5.2` | Classify relationships in batches |
| `openai.embeddings.create()` | `text-embedding-3-large` | Generate 3072-dim embeddings for similarity |

### Authentication

None. No auth layer exists. Routes assume trusted execution environment.

---

## 6. Documentation Gaps & Issues

### Critical Discrepancies

| Issue | Where | Actual |
|---|---|---|
| GPT model listed as "GPT-4.1" | `README.md` | Code uses `gpt-5.2` |
| Database listed as "Drizzle + SQLite" | `PRD.md` | Migrated to Convex |
| Job polling "every 2s" | `PRD.md` | Reactive `useQuery` (no polling) |

### Undocumented Behaviors

1. **DEFAULT_MIN_CONFIDENCE = 60%** — hardcoded in FilterPanel, not mentioned anywhere
2. **Auto-linking fires once per session** — useRef guard prevents re-triggering
3. **Node dedup strategy** — lower-confidence node is deleted when ≥0.88 similarity
4. **DOMMatrix polyfill** — required for pdfjs-dist server-side, no explanation in code
5. **Locator JSON format** — `EvidenceLocator` type exists in `src/lib/convex.ts` but format undocumented
6. **Remotion video content** — `remotion/` directory exists for promo video, minimal docs
7. **Onboarding dialog** — described as "5-step" but individual steps not listed
8. **Focus mode mechanics** — double-click activates, non-connected nodes fade to 6% opacity

### Missing Documentation

- No CI/CD pipeline or GitHub Actions
- No rate limiting on API routes
- No application logging/monitoring configuration
- No database backup strategy documented
- No `.env.prod.example` file (docker-compose references `.env.prod`)
- Magic numbers (0.4, 0.88, 20, 40–500, 15 min, 60%) lack rationale

### Recommendations

**Immediate:**
1. Update `README.md`: GPT-4.1 → GPT-5.2
2. Archive or update `PRD.md` (reflects pre-Convex architecture)
3. Rotate `OPENAI_API_KEY` if `.env.local` was ever committed to git history

**Short-term:**
4. Add GitHub Actions CI (lint, typecheck, build)
5. Create `.env.prod.example`
6. Document magic numbers with rationale
7. Add rate limiting on upload route

**Medium-term:**
8. Add authentication layer
9. Add structured logging
10. Document Convex backup/disaster recovery
11. Consider separating Remotion into its own package

---

## 7. Key File Reference

| Path | Purpose |
|---|---|
| `convex/schema.ts` | Database schema (7 tables) |
| `convex/extraction.ts` + `convex/extractionAction.ts` | Idea extraction pipeline |
| `convex/linking.ts` + `convex/linkingAction.ts` | Relationship linking pipeline |
| `convex/jobs.ts` | Job tracking with stale timeout |
| `convex/graph.ts` | Full graph export query |
| `convex/projects.ts` | Project CRUD + cascade deletion |
| `src/components/WorkspaceClient.tsx` | Main workspace layout orchestrator |
| `src/components/graph/GraphCanvas.tsx` | React Flow integration (~600 lines) |
| `src/components/graph/FilterPanel.tsx` | Document/edge-type/confidence filters |
| `src/components/documents/Sidebar.tsx` | Upload + extraction/linking controls |
| `src/components/documents/PdfEvidenceModal.tsx` | PDF viewer with highlights |
| `src/components/inspector/NodeInspector.tsx` | Resizable node detail panel |
| `src/lib/graph/layout.ts` | Document-grouped grid layout algorithm |
| `src/lib/convex.ts` | API re-exports + EvidenceLocator type |
| `src/app/api/projects/[id]/upload/route.ts` | PDF upload with validation |
| `next.config.ts` | Standalone build + security headers |
| `Dockerfile` | Multi-stage build (Node 24 Alpine) |
| `docker-compose.yml` | Traefik + volume config |
