'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Input } from '@/components/ui/input';
import { IdeaNode } from '@/components/graph/IdeaNode';
import { RelationshipEdge } from '@/components/graph/RelationshipEdge';
import type { NodeInspectorData } from '@/components/inspector/NodeInspector';

const nodeTypes = { idea: IdeaNode };
const edgeTypes = { relationship: RelationshipEdge };

type GraphNode = {
  id: string;
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string }[];
  position: { x: number; y: number };
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  evidence: { documentId: string; filename: string; excerpt: string }[];
};

export type GraphCanvasHandle = {
  refresh: () => void;
};

function toFlowNodes(graphNodes: GraphNode[]): Node[] {
  return graphNodes.map((n) => ({
    id: n.id,
    type: 'idea',
    position: n.position,
    data: {
      label: n.label,
      summary: n.summary,
      tags: n.tags,
      sources: n.sources,
    },
  }));
}

function toFlowEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'relationship',
    data: {
      relType: e.type,
      confidence: e.confidence,
      evidence: e.evidence,
    },
  }));
}

type EdgeClickData = {
  relType: string;
  confidence: number;
  evidence: { documentId: string; filename: string; excerpt: string }[];
};

export type GraphFilters = {
  documentIds: string[];
  edgeTypes: string[];
  minConfidence: number;
};

export type GraphMetadata = {
  documents: { id: string; filename: string }[];
  edgeTypes: string[];
};

type GraphCanvasProps = {
  projectId: string;
  filters?: GraphFilters;
  onNodeClick?: (data: NodeInspectorData) => void;
  onEdgeClick?: (data: EdgeClickData) => void;
  onMetadata?: (meta: GraphMetadata) => void;
};

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas({ projectId, filters, onNodeClick, onEdgeClick, onMetadata }, ref) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [search, setSearch] = useState('');
    const abortRef = useRef<AbortController | null>(null);
    const rawDataRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

    useImperativeHandle(ref, () => ({
      refresh: () => setRefreshKey((k) => k + 1),
    }));

    useEffect(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/projects/${projectId}/graph`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch graph');
          return res.json();
        })
        .then((data: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
          if (controller.signal.aborted) return;
          rawDataRef.current = data;

          const docMap = new Map<string, string>();
          for (const n of data.nodes) {
            for (const s of n.sources) {
              docMap.set(s.documentId, s.filename);
            }
          }
          const uniqueEdgeTypes = [...new Set(data.edges.map((e) => e.type))];
          onMetadata?.({
            documents: [...docMap.entries()].map(([id, filename]) => ({ id, filename })),
            edgeTypes: uniqueEdgeTypes,
          });

          setNodes(toFlowNodes(data.nodes));
          setEdges(toFlowEdges(data.edges));
          setLoading(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.error('Graph fetch error:', err);
          setLoading(false);
        });

      return () => controller.abort();
    }, [projectId, refreshKey, setNodes, setEdges, onMetadata]);

    useEffect(() => {
      const { nodes: rawNodes, edges: rawEdges } = rawDataRef.current;
      if (rawNodes.length === 0) return;

      let filteredNodes = rawNodes;
      let filteredEdges = rawEdges;

      if (filters) {
        if (filters.documentIds.length > 0) {
          const docSet = new Set(filters.documentIds);
          filteredNodes = filteredNodes.filter((n) =>
            n.sources.some((s) => docSet.has(s.documentId)),
          );
        }
        const nodeIds = new Set(filteredNodes.map((n) => n.id));
        filteredEdges = filteredEdges.filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
        );
        if (filters.edgeTypes.length > 0) {
          const typeSet = new Set(filters.edgeTypes);
          filteredEdges = filteredEdges.filter((e) => typeSet.has(e.type));
        }
        if (filters.minConfidence > 0) {
          filteredEdges = filteredEdges.filter(
            (e) => e.confidence >= filters.minConfidence / 100,
          );
        }
      }

      setNodes(toFlowNodes(filteredNodes));
      setEdges(toFlowEdges(filteredEdges));
    }, [filters, setNodes, setEdges]);

    const nodeMatchesSearch = useCallback(
      (data: Record<string, unknown>, query: string): boolean => {
        const label = (data.label as string) ?? '';
        const tags = (data.tags as string[]) ?? [];
        return (
          label.toLowerCase().includes(query) ||
          tags.some((tag) => tag.toLowerCase().includes(query))
        );
      },
      [],
    );

    useEffect(() => {
      const query = search.trim().toLowerCase();

      setNodes((currentNodes) => {
        const matchingIds = new Set(
          query === ''
            ? currentNodes.map((n) => n.id)
            : currentNodes
                .filter((n) => nodeMatchesSearch(n.data as Record<string, unknown>, query))
                .map((n) => n.id),
        );

        setEdges((currentEdges) =>
          currentEdges.map((edge) => {
            const connected = matchingIds.has(edge.source) && matchingIds.has(edge.target);
            return { ...edge, style: { ...edge.style, opacity: connected ? 1 : 0.2 } };
          }),
        );

        return currentNodes.map((node) => ({
          ...node,
          style: { ...node.style, opacity: matchingIds.has(node.id) ? 1 : 0.2 },
        }));
      });
    }, [search, setNodes, setEdges, nodeMatchesSearch]);

    if (loading) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading graph...
        </div>
      );
    }

    if (nodes.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          No ideas extracted yet. Upload a PDF and extract ideas to see the graph.
        </div>
      );
    }

    return (
      <div className="relative h-full w-full">
        <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 w-72">
          <Input
            placeholder="Search by label or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background/90 backdrop-blur-sm shadow-md"
          />
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_event, node) => {
            const d = node.data as Record<string, unknown>;
            onNodeClick?.({
              label: d.label as string,
              summary: d.summary as string,
              tags: d.tags as string[],
              sources: d.sources as NodeInspectorData['sources'],
            });
          }}
          onEdgeClick={(_event, edge) => {
            const d = edge.data as Record<string, unknown>;
            onEdgeClick?.({
              relType: d.relType as string,
              confidence: d.confidence as number,
              evidence: d.evidence as EdgeClickData['evidence'],
            });
          }}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>
    );
  }
);
