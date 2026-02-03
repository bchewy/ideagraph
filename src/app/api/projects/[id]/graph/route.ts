import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nodes, edges, evidenceRefs, projects, documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (project.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const projectNodes = await db
    .select({
      id: nodes.id,
      label: nodes.label,
      summary: nodes.summary,
      tags: nodes.tags,
    })
    .from(nodes)
    .where(eq(nodes.projectId, projectId));

  const nodeEvidenceByNodeId = await Promise.all(
    projectNodes.map(async (node) => {
      const evidence = await db
        .select({
          documentId: evidenceRefs.documentId,
          excerpt: evidenceRefs.excerpt,
          filename: documents.filename,
        })
        .from(evidenceRefs)
        .innerJoin(documents, eq(evidenceRefs.documentId, documents.id))
        .where(eq(evidenceRefs.nodeId, node.id));
      return { nodeId: node.id, evidence };
    })
  );

  const evidenceMap = new Map(
    nodeEvidenceByNodeId.map((e) => [e.nodeId, e.evidence])
  );

  const graphNodes = projectNodes.map((node) => ({
    id: node.id,
    label: node.label,
    summary: node.summary,
    tags: JSON.parse(node.tags) as string[],
    sources: (evidenceMap.get(node.id) || []).map((e) => ({
      documentId: e.documentId,
      filename: e.filename,
      excerpt: e.excerpt,
    })),
  }));

  const projectEdges = await db
    .select({
      id: edges.id,
      sourceNodeId: edges.sourceNodeId,
      targetNodeId: edges.targetNodeId,
      type: edges.type,
      confidence: edges.confidence,
    })
    .from(edges)
    .where(eq(edges.projectId, projectId));

  const edgeEvidenceByEdgeId = await Promise.all(
    projectEdges.map(async (edge) => {
      const evidence = await db
        .select({
          documentId: evidenceRefs.documentId,
          excerpt: evidenceRefs.excerpt,
          filename: documents.filename,
        })
        .from(evidenceRefs)
        .innerJoin(documents, eq(evidenceRefs.documentId, documents.id))
        .where(eq(evidenceRefs.edgeId, edge.id));
      return { edgeId: edge.id, evidence };
    })
  );

  const edgeEvidenceMap = new Map(
    edgeEvidenceByEdgeId.map((e) => [e.edgeId, e.evidence])
  );

  const graphEdges = projectEdges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: edge.type,
    confidence: edge.confidence,
    evidence: (edgeEvidenceMap.get(edge.id) || []).map((e) => ({
      documentId: e.documentId,
      filename: e.filename,
      excerpt: e.excerpt,
    })),
  }));

  return NextResponse.json({ nodes: graphNodes, edges: graphEdges });
}
