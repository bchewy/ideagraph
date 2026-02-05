# IdeaGraph

IdeaGraph is a knowledge graph app that extracts ideas from PDFs using OpenAI and visualizes them as an interactive graph with evidence attribution.

## Features
- PDF upload with automatic idea extraction (max 30 per doc).
- Relationship linking via embeddings + GPT classification.
- Interactive graph visualization (React Flow) with inspectors.
- Evidence references tied to source document snippets.

## Tech Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS + shadcn/ui
- Convex (database + actions + jobs)
- OpenAI SDK (GPT-4.1 + embeddings)
- React Flow for graph visualization

## Quickstart
1) Install dependencies
2) Set environment variables
3) Run Convex dev sync
4) Start the Next.js dev server

```bash
npm install
cp .env.local.example .env.local
# edit .env.local with your keys

npx convex dev
# in another terminal
npm run dev
```

Open `http://localhost:3000` and upload a PDF.

## Environment
Create `.env.local` (copy from `.env.local.example`):

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API access (server + Convex actions) |
| `CONVEX_DEPLOYMENT` | Set by `npx convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | Set by `npx convex dev` |

Also set the OpenAI key in Convex:
```bash
npx convex env set OPENAI_API_KEY <key>
```

## Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npx convex dev` | Start Convex dev sync |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run remotion:studio` | Remotion Studio |
| `npm run remotion:render` | Render promo video |
| `npm run remotion:render-short` | Render short promo video |

## Architecture (Pipeline)
1) **Upload**: PDF saved to `uploads/{projectId}/` and uploaded to OpenAI Files API.
2) **Extract**: Convex action calls GPT-4.1 Structured Outputs to extract ideas → nodes + evidenceRefs.
3) **Link**: Embeddings + similarity scoring → GPT classification → edges.
4) **Display**: React Flow graph + inspectors on the frontend.

## Project Structure
- `src/app/` — Next.js App Router routes and layouts
- `src/components/` — UI + graph + inspectors
- `src/lib/` — client utilities, graph layout helpers
- `convex/` — schema, queries, mutations, actions, jobs
- `remotion/` — video scenes and composition config
- `public/` — static assets

## API Routes
- `POST /api/projects/[id]/upload` — multipart PDF upload

All other data operations use Convex functions via `useQuery`/`useMutation`.

## Graph Edge Types
`supports`, `contradicts`, `extends`, `similar`, `example_of`, `depends_on`

## Notes
- Local PDFs live under `uploads/` (gitignored). Do not commit.
- Convex IDs are typed as `Id<"tableName">`.
