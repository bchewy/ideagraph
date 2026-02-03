# AGENTS.md

## Project Overview
- IdeaGraph is a knowledge graph app that extracts ideas from PDFs using OpenAI and visualizes them in an interactive graph.
- Stack: Next.js App Router (TypeScript), Tailwind + shadcn/ui, Convex backend, React Flow visualization.

## Build and Test Commands
- `npm run dev` — start Next.js dev server
- `npx convex dev` — start Convex dev sync (run in parallel)
- `npm run build` — production build
- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint

## Code Style Guidelines
- Follow existing file structure and naming patterns.
- Use the project’s lint/format setup (ESLint + Prettier/Tailwind conventions).
- Prefer small, focused changes; place new modules alongside related code.

## Testing Instructions
- Run the smallest relevant test or check first (typecheck/lint) before full builds.
- For UI changes, verify the affected page locally with `npm run dev`.

## Security Considerations
- Do not commit secrets. Use `.env.local` and update `.env.local.example` when adding new vars.
- Keep API keys only in Convex env (`npx convex env set`).

## Commit and PR Guidelines
- Use Conventional Commits when creating commits (e.g., `feat:`, `fix:`, `chore:`).
- PRs should include a summary, testing notes, and screenshots for UI changes.
