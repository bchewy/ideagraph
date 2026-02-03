---
name: IdeaGraph MVP
overview: Build IdeaGraph - a Next.js 16 app where users upload PDFs, extract ideas via GPT-5.2, generate typed relationship edges, and explore the result on a React Flow whiteboard canvas with evidence-backed nodes and edges.
todos:
  - id: setup
    content: "Project setup: Next.js 16, Tailwind, shadcn/ui, Drizzle + SQLite, OpenAI SDK"
    status: pending
  - id: schema
    content: Define Drizzle schema for projects, documents, nodes, edges, evidenceRefs, jobs
    status: pending
  - id: upload
    content: "Build PDF upload: dropzone UI, local storage, OpenAI Files API upload, document status tracking"
    status: pending
  - id: extract
    content: "Build extraction pipeline: Responses API call with PDF, Structured Outputs schema, store nodes + evidence"
    status: pending
  - id: embeddings
    content: "Build embedding pipeline: generate embeddings for nodes, store vectors, cosine similarity for candidates"
    status: pending
  - id: link
    content: "Build linking pipeline: candidate pair generation, GPT-5.2 relationship classification, dedupe at 0.88"
    status: pending
  - id: graph-canvas
    content: "Build React Flow canvas: force-directed layout, custom IdeaNode, custom RelationshipEdge, pan/zoom/minimap"
    status: pending
  - id: inspector
    content: "Build inspector panel: NodeInspector and EdgeInspector with evidence display"
    status: pending
  - id: polling
    content: "Implement job polling: jobs table, status endpoint, frontend polling with loading states"
    status: pending
  - id: filters
    content: "Add search and filters: search by label/tag, filter by doc/type/confidence"
    status: pending
  - id: export
    content: Add JSON export of graph data
    status: pending
isProject: false
---

# IdeaGraph MVP Implementation Plan

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Graph Canvas**: React Flow
- **Database**: SQLite via Drizzle ORM
- **AI**: OpenAI Responses API + GPT-5.2 + text-embedding-3-large
- **Storage**: Local `uploads/` folder
- **Styling**: Tailwind CSS + shadcn/ui

## Architecture Overview

```mermaid
flowchart LR
    subgraph frontend [Frontend]
        Upload[PDF Upload]
        Canvas[React Flow Canvas]
        Inspector[Node/Edge Inspector]
    end
    
    subgraph backend [API Routes]
        UploadAPI[/api/projects/:id/upload]
        ExtractAPI[/api/projects/:id/extract]
        LinkAPI[/api/projects/:id/link]
        GraphAPI[/api/projects/:id/graph]
    end
    
    subgraph external [External]
        OpenAI[OpenAI API]
        Files[OpenAI Files API]
    end
    
    Upload --> UploadAPI
    UploadAPI --> Files
    ExtractAPI --> OpenAI
    LinkAPI --> OpenAI
    Canvas --> GraphAPI
```



## Data Model (Drizzle + SQLite)

```typescript
// schema.ts
projects: { id, name, createdAt }
documents: { id, projectId, filename, openaiFileId, status, sizeBytes, createdAt }
nodes: { id, projectId, label, summary, tags, createdAt }
edges: { id, projectId, sourceNodeId, targetNodeId, type, confidence, createdAt }
evidenceRefs: { id, nodeId?, edgeId?, documentId, excerpt, locator? }
jobs: { id, projectId, type, status, error?, createdAt, completedAt? }
```

## Key Implementation Details

### 1. PDF Upload Flow

- Accept PDFs up to 50MB via `/api/projects/:id/upload`
- Save to `uploads/{projectId}/{filename}`
- Upload to OpenAI Files API, store `openaiFileId`
- Set document status: `uploaded`

### 2. Idea Extraction Pipeline

- Call OpenAI Responses API with PDF file reference
- Use Structured Outputs (JSON Schema) for deterministic parsing
- Extract: `{ nodes: [{ label, summary, tags, sources: [{ excerpt }] }] }`
- Cap at 30 nodes per document
- Store nodes + evidence refs in SQLite
- Update document status: `extracted`

### 3. Link Generation Pipeline

- Generate embeddings for all nodes (text-embedding-3-large)
- Find candidate pairs with cosine similarity > 0.4 (pre-filter)
- Dedupe nodes with similarity >= 0.88 (merge into single node)
- Send candidate pairs to GPT-5.2 for relationship classification
- Output: `{ edges: [{ source, target, type, confidence, evidence }] }`
- Edge types: supports, contradicts, extends, similar, example_of, depends_on
- Only create edges with evidence; filter by confidence threshold

### 4. React Flow Graph Canvas

- Force-directed layout via dagre
- Custom node component showing label + source doc badge
- Custom edge component with colored type indicator
- Pan/zoom/minimap
- Click node/edge to open inspector panel

### 5. Inspector Panel

- Node: show summary, tags, all evidence excerpts with doc attribution
- Edge: show relationship type, confidence, evidence excerpts

### 6. Polling for Async Jobs

- POST `/api/projects/:id/extract` creates job, returns `jobId`
- GET `/api/jobs/:id` returns status
- Frontend polls every 2s until complete

### 7. Incremental Updates

- New PDFs: extract nodes, run linking against all existing nodes
- Update existing edges if new evidence changes relationships
- Preserve node IDs for stability

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Projects list
│   ├── projects/[id]/
│   │   └── page.tsx                # Workspace (graph + inspector)
│   └── api/
│       ├── projects/
│       │   └── [id]/
│       │       ├── upload/route.ts
│       │       ├── extract/route.ts
│       │       ├── link/route.ts
│       │       └── graph/route.ts
│       └── jobs/[id]/route.ts
├── components/
│   ├── graph/
│   │   ├── GraphCanvas.tsx
│   │   ├── IdeaNode.tsx
│   │   └── RelationshipEdge.tsx
│   ├── inspector/
│   │   ├── NodeInspector.tsx
│   │   └── EdgeInspector.tsx
│   ├── documents/
│   │   ├── DocumentList.tsx
│   │   └── UploadDropzone.tsx
│   └── ui/                         # shadcn components
├── lib/
│   ├── db/
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── openai/
│   │   ├── extract.ts
│   │   ├── link.ts
│   │   └── embeddings.ts
│   └── graph/
│       └── layout.ts               # dagre layout
└── uploads/                        # PDF storage
```

## API Contracts

**POST /api/projects/:id/extract**

```json
{ "documentIds": ["doc1", "doc2"] }
// Returns: { "jobId": "job123" }
```

**GET /api/projects/:id/graph**

```json
{
  "nodes": [{ "id", "label", "summary", "tags", "sources": [{ "documentId", "excerpt" }] }],
  "edges": [{ "id", "source", "target", "type", "confidence", "evidence": [...] }]
}
```

## OpenAI Integration

- Use `openai.responses.create()` with file inputs
- Reference uploaded PDFs via `file_id`
- Structured Outputs schema for extraction and linking
- Embedding calls via `openai.embeddings.create()`

