# Convex Backend

This directory contains all Convex functions for IdeaGraph — a knowledge graph app that extracts ideas from PDFs using OpenAI.

## File Structure

| File | Purpose |
|------|---------|
| `schema.ts` | Database schema (projects, documents, nodes, edges, evidenceRefs, jobs) |
| `projects.ts` | Project CRUD queries and mutations |
| `documents.ts` | Document queries and mutations |
| `graph.ts` | Graph data query (nodes + edges + evidence) |
| `jobs.ts` | Job status queries and internal mutations |
| `extraction.ts` | Idea extraction mutation (schedules action) |
| `extractionAction.ts` | Node.js action calling OpenAI for extraction |
| `linking.ts` | Relationship linking mutation (schedules action) |
| `linkingAction.ts` | Node.js action calling OpenAI for embeddings + classification |

## Development

```bash
npx convex dev    # Start Convex dev sync (run alongside npm run dev)
npx convex deploy # Deploy to production
```

## Environment Variables

Set the OpenAI API key in Convex:

```bash
npx convex env set OPENAI_API_KEY <your-key>
```

## Architecture Notes

- Long-running operations use the **mutation → scheduler → action** pattern
- Frontend subscribes to job status reactively via `useQuery` (no polling)
- Actions run in Node.js runtime for OpenAI SDK compatibility
- IDs are Convex-generated (`Id<"tableName">`), timestamps use `_creationTime`
