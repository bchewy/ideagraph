'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useQuery } from 'convex/react';
import { api, type Id } from '@/lib/convex';
import { computeLayout, type GroupBox } from '@/lib/graph/layout';
import { Input } from '@/components/ui/input';
import { IdeaNode } from '@/components/graph/IdeaNode';
import { RelationshipEdge } from '@/components/graph/RelationshipEdge';
import { DocumentGroup } from '@/components/graph/DocumentGroup';
import type { NodeInspectorData } from '@/components/inspector/NodeInspector';

const nodeTypes = { idea: IdeaNode, documentGroup: DocumentGroup };
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

export type GraphFilters = {
  documentIds: string[];
  edgeTypes: string[];
  minConfidence: number;
};

export type GraphMetadata = {
  documents: { id: string; filename: string }[];
  edgeTypes: string[];
};

function toFlowNodes(graphNodes: GraphNode[], groups: GroupBox[]): Node[] {
  const groupNodes: Node[] = groups.map((g) => ({
    id: `group-${g.documentId}`,
    type: 'documentGroup',
    position: { x: g.x, y: g.y },
    data: { label: g.filename, width: g.width, height: g.height },
    selectable: false,
    draggable: false,
    style: { zIndex: -1 },
  }));

  const ideaNodes: Node[] = graphNodes.map((n) => ({
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

  return [...groupNodes, ...ideaNodes];
}

const MIN_CONFIDENCE = 0.5;

function toFlowEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.filter((e) => e.confidence >= MIN_CONFIDENCE).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'relationship',
    style: { opacity: 0.6 },
    data: {
      relType: e.type,
      confidence: e.confidence,
      showLabel: false,
      evidence: e.evidence,
    },
  }));
}

type EdgeClickData = {
  relType: string;
  confidence: number;
  evidence: { documentId: string; filename: string; excerpt: string }[];
};

type GraphCanvasProps = {
  projectId: Id<"projects">;
  filters?: GraphFilters;
  onNodeClick?: (data: NodeInspectorData) => void;
  onEdgeClick?: (data: EdgeClickData) => void;
  onMetadata?: (meta: GraphMetadata) => void;
};

function getNeighborIds(nodeId: string, allEdges: Edge[]): Set<string> {
  const neighbors = new Set<string>();
  neighbors.add(nodeId);
  for (const e of allEdges) {
    if (e.source === nodeId) neighbors.add(e.target);
    if (e.target === nodeId) neighbors.add(e.source);
  }
  return neighbors;
}

export function GraphCanvas({
  projectId,
  filters,
  onNodeClick,
  onEdgeClick,
  onMetadata,
}: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [search, setSearch] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Reactive graph data from Convex
  const graphData = useQuery(api.graph.get, { projectId });

  // Compute layout from raw graph data
  const computed = useMemo(() => {
    if (!graphData) return null;

    const { positions, groups } = computeLayout(graphData.nodes, graphData.edges);

    // Resolve group filenames from node sources
    const docFilenames = new Map<string, string>();
    for (const node of graphData.nodes) {
      for (const s of node.sources) {
        docFilenames.set(s.documentId, s.filename);
      }
    }
    const resolvedGroups = groups.map((g) => ({
      ...g,
      filename: docFilenames.get(g.documentId) ?? g.filename,
    }));

    const nodesWithPositions: GraphNode[] = graphData.nodes.map((n) => ({
      ...n,
      position: positions.get(n.id) ?? { x: 0, y: 0 },
    }));

    return {
      nodes: nodesWithPositions,
      edges: graphData.edges as GraphEdge[],
      groups: resolvedGroups,
    };
  }, [graphData]);

  const computedRef = useRef(computed);
  const filteredFlowRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  // Emit metadata + set flow data when computed data changes
  useEffect(() => {
    computedRef.current = computed;
    if (!computed) return;

    const docMap = new Map<string, string>();
    for (const n of computed.nodes) {
      for (const s of n.sources) {
        docMap.set(s.documentId, s.filename);
      }
    }
    onMetadata?.({
      documents: [...docMap.entries()].map(([id, filename]) => ({ id, filename })),
      edgeTypes: [...new Set(computed.edges.map((e) => e.type))],
    });

    applyFiltersAndSet(computed.nodes, computed.edges, computed.groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed]);

  // Apply sidebar filters
  useEffect(() => {
    if (!computedRef.current) return;
    const { nodes: rawNodes, edges: rawEdges, groups } = computedRef.current;
    if (rawNodes.length === 0) return;
    applyFiltersAndSet(rawNodes, rawEdges, groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function applyFiltersAndSet(
    rawNodes: GraphNode[],
    rawEdges: GraphEdge[],
    groups: GroupBox[]
  ) {
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

    const flowNodes = toFlowNodes(filteredNodes, groups);
    const flowEdges = toFlowEdges(filteredEdges);
    filteredFlowRef.current = { nodes: flowNodes, edges: flowEdges };

    if (focusedNodeId) {
      applyFocus(focusedNodeId, flowNodes, flowEdges);
    } else {
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }

  // ── Focus mode ──
  const applyFocus = useCallback(
    (nodeId: string, baseNodes: Node[], baseEdges: Edge[]) => {
      const neighborIds = getNeighborIds(nodeId, baseEdges);

      setNodes(
        baseNodes.map((node) => {
          if (node.type === 'documentGroup') {
            return { ...node, style: { ...node.style, opacity: 0.3 } };
          }
          return {
            ...node,
            style: {
              ...node.style,
              opacity: neighborIds.has(node.id) ? 1 : 0.06,
              transition: 'opacity 0.2s ease',
              pointerEvents: neighborIds.has(node.id) ? 'all' as const : 'none' as const,
            },
          };
        }),
      );
      setEdges(
        baseEdges.map((edge) => {
          const connected =
            (edge.source === nodeId && neighborIds.has(edge.target)) ||
            (edge.target === nodeId && neighborIds.has(edge.source));
          return {
            ...edge,
            data: { ...edge.data, showLabel: connected },
            style: {
              ...edge.style,
              opacity: connected ? 1 : 0.03,
              transition: 'opacity 0.2s ease',
            },
          };
        }),
      );
    },
    [setNodes, setEdges],
  );

  const clearFocus = useCallback(() => {
    setFocusedNodeId(null);
    const { nodes: baseNodes, edges: baseEdges } = filteredFlowRef.current;
    setNodes(
      baseNodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: n.type === 'documentGroup' ? undefined : 1,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'all' as const,
        },
      })),
    );
    setEdges(
      baseEdges.map((e) => ({
        ...e,
        data: { ...e.data, showLabel: false },
        style: { ...e.style, opacity: undefined, transition: 'opacity 0.2s ease' },
      })),
    );
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!focusedNodeId) return;
    const { nodes: baseNodes, edges: baseEdges } = filteredFlowRef.current;
    if (baseNodes.length === 0) return;
    applyFocus(focusedNodeId, baseNodes, baseEdges);
  }, [focusedNodeId, applyFocus]);

  // ── Search ──
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
    if (focusedNodeId) return;
    const query = search.trim().toLowerCase();

    setNodes((currentNodes) => {
      const matchingIds = new Set(
        query === ''
          ? currentNodes.filter((n) => n.type === 'idea').map((n) => n.id)
          : currentNodes
              .filter((n) => n.type === 'idea' && nodeMatchesSearch(n.data as Record<string, unknown>, query))
              .map((n) => n.id),
      );

      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          const connected = matchingIds.has(edge.source) && matchingIds.has(edge.target);
          return { ...edge, style: { ...edge.style, opacity: connected ? undefined : 0.05 } };
        }),
      );

      return currentNodes.map((node) => {
        if (node.type === 'documentGroup') return node;
        return {
          ...node,
          style: { ...node.style, opacity: matchingIds.has(node.id) ? 1 : 0.15 },
        };
      });
    });
  }, [search, setNodes, setEdges, nodeMatchesSearch, focusedNodeId]);

  if (graphData === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading graph...
      </div>
    );
  }

  if (nodes.filter((n) => n.type === 'idea').length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No ideas extracted yet. Upload a PDF and extract ideas to see the graph.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2">
        <Input
          placeholder="Search by label or tag..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (focusedNodeId) clearFocus();
          }}
          className="w-72 bg-card border-border shadow-lg text-xs"
        />
        {focusedNodeId && (
          <button
            onClick={clearFocus}
            className="shrink-0 rounded border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Show all
          </button>
        )}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_event, node) => {
          if (node.type === 'documentGroup') return;
          const d = node.data as Record<string, unknown>;

          if (focusedNodeId === node.id) {
            clearFocus();
          } else {
            setFocusedNodeId(node.id);
          }

          const currentEdges = filteredFlowRef.current.edges;
          const currentNodes = filteredFlowRef.current.nodes;
          const nodeMap = new Map(
            currentNodes
              .filter((n) => n.type === 'idea')
              .map((n) => [n.id, n.data as Record<string, unknown>]),
          );
          const linkedNodes: NodeInspectorData['linkedNodes'] = [];
          for (const edge of currentEdges) {
            const ed = edge.data as Record<string, unknown> | undefined;
            if (!ed) continue;
            let neighborId: string | null = null;
            if (edge.source === node.id) neighborId = edge.target;
            else if (edge.target === node.id) neighborId = edge.source;
            if (!neighborId) continue;
            const neighbor = nodeMap.get(neighborId);
            if (!neighbor) continue;
            linkedNodes.push({
              label: neighbor.label as string,
              relType: ed.relType as string,
              confidence: ed.confidence as number,
            });
          }

          onNodeClick?.({
            label: d.label as string,
            summary: d.summary as string,
            tags: d.tags as string[],
            sources: d.sources as NodeInspectorData['sources'],
            linkedNodes,
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
        onPaneClick={() => {
          if (focusedNodeId) clearFocus();
        }}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
      >
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor="#1a1a1a"
          maskColor="rgba(0, 0, 0, 0.7)"
        />
        <Background color="#141414" />
      </ReactFlow>
    </div>
  );
}
