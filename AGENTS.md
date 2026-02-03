# AGENTS.md

## Project Overview
- IdeaGraph is a knowledge graph app that extracts ideas from PDFs using OpenAI and visualizes them in an interactive graph.
- Stack: Next.js App Router (TypeScript), Tailwind + shadcn/ui, Convex backend, React Flow visualization.

## Key Directories
- `src/app` — Next.js App Router routes and layouts.
- `src/components` — shared UI components (shadcn/ui + custom).
- `src/lib` — client utilities, graph helpers, API wrappers.
- `convex` — Convex schema, queries, mutations, actions.
- `public` — static assets.
- `uploads` — local PDF uploads (dev only; do not commit).

## Build and Test Commands
- `npm run dev` — start Next.js dev server
- `npx convex dev` — start Convex dev sync (run in parallel)
- `npm run build` — production build
- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint

## Local Development Setup
- Create `.env.local` with required keys (OpenAI, Convex deployment URL/keys).
- Start `npx convex dev` before running `npm run dev` so mutations/actions can run.
- Keep local PDFs in `uploads/`; they should remain gitignored.

## Code Style Guidelines
- Follow existing file structure and naming patterns.
- Use the project’s lint/format setup (ESLint + Prettier/Tailwind conventions).
- Prefer small, focused changes; place new modules alongside related code.
- For Convex functions, keep query/mutation/action names descriptive and colocate helpers in `convex/`.
- For UI, prefer composing existing shadcn/ui primitives over new bespoke components.

## Testing Instructions
- Run the smallest relevant test or check first (typecheck/lint) before full builds.
- For UI changes, verify the affected page locally with `npm run dev`.
- For Convex changes, verify in the Convex dashboard logs or local terminal output.

## Security Considerations
- Do not commit secrets. Use `.env.local` and update `.env.local.example` when adding new vars.
- Keep API keys only in Convex env (`npx convex env set`).
- Redact any sample PDFs or user data before sharing outside the repo.
- Do not store raw PDFs in Convex; store derived metadata or extracted nodes only.

## Commit and PR Guidelines
- Use Conventional Commits when creating commits (e.g., `feat:`, `fix:`, `chore:`).
- PRs should include a summary, testing notes, and screenshots for UI changes.

## Implementation Notes
- Graph data should be normalized and stored in Convex; prefer stable IDs for nodes/edges.
- React Flow state should be derived from Convex data; avoid duplicating source-of-truth in client state.
- PDF processing should be done in Convex actions (server-side) using OpenAI; client only uploads and polls.
- Add any new background jobs or processing steps to `convex/` with clear separation of concerns.
