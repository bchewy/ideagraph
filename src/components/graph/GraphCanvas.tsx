'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type ReactFlowInstance,
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
import { AsciiLoader } from '@/components/AsciiLoader';
import type { NodeInspectorData } from '@/components/inspector/NodeInspector';

const nodeTypes = { idea: IdeaNode, documentGroup: DocumentGroup };
const edgeTypes = { relationship: RelationshipEdge };

type GraphNode = {
  id: string;
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string; locator?: string }[];
  position: { x: number; y: number };
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  reasoning?: string;
  evidence: { documentId: string; filename: string; excerpt: string; locator?: string }[];
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

function toFlowNodes(
  graphNodes: GraphNode[],
  groups: GroupBox[],
  newIds?: Set<string>,
): Node[] {
  const groupByDocId = new Map<string, GroupBox>();
  for (const g of groups) groupByDocId.set(g.documentId, g);

  const groupNodes: Node[] = groups.map((g) => ({
    id: `group-${g.documentId}`,
    type: 'documentGroup',
    position: { x: g.x, y: g.y },
    data: { label: g.filename, summary: g.summary, width: g.width, height: g.height },
    selectable: false,
    draggable: true,
    dragHandle: '.doc-group__drag',
    // Let edges stay interactive even when they pass "under" the group rectangle.
    // The header remains draggable via the dragHandle selector.
    style: { pointerEvents: 'none' },
  }));

  let newIndex = 0;
  const ideaNodes: Node[] = graphNodes.map((n) => {
    const isNew = newIds?.has(n.id) ?? false;
    const docId = n.sources?.[0]?.documentId ?? '__ungrouped';
    const group = groupByDocId.get(docId) ?? groupByDocId.get('__ungrouped');
    const parentId = group ? `group-${group.documentId}` : undefined;
    const position = group
      ? { x: n.position.x - group.x, y: n.position.y - group.y }
      : n.position;
    const node: Node = {
      id: n.id,
      type: 'idea',
      position,
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
      data: {
        label: n.label,
        summary: n.summary,
        tags: n.tags,
        sources: n.sources,
        isNew,
      },
    };
    if (isNew) {
      node.style = { animationDelay: `${newIndex * 60}ms` };
      newIndex++;
    }
    return node;
  });

  return [...groupNodes, ...ideaNodes];
}

const MIN_CONFIDENCE = 0.5;

function toFlowEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.filter((e) => e.confidence >= MIN_CONFIDENCE).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'relationship',
    // Parent/child nodes cause React Flow to elevate edges into the node z-index band.
    // Keep edges behind document groups so group headers/summaries stay readable.
    zIndex: -1,
    style: { opacity: 0.6 },
    data: {
      relType: e.type,
      confidence: e.confidence,
      showLabel: false,
      reasoning: e.reasoning,
      evidence: e.evidence,
    },
  }));
}

type EdgeClickData = {
  relType: string;
  confidence: number;
  reasoning?: string;
  evidence: { documentId: string; filename: string; excerpt: string; locator?: string }[];
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
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const ideaNodeCount = useMemo(
    () => nodes.reduce((acc, n) => (n.type === 'idea' ? acc + 1 : acc), 0),
    [nodes],
  );
  const isLargeGraph = ideaNodeCount > 200 || edges.length > 450;

  // Track known node IDs to detect newly added nodes for entrance animation
  const knownNodeIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Reactive graph data from Convex
  const graphData = useQuery(api.graph.get, { projectId });

  // Compute layout from raw graph data
  const computed = useMemo(() => {
    if (!graphData) return null;

    // Build summaries map from document data
    const docSummaries = new Map<string, string>();
    if (graphData.documents) {
      for (const doc of graphData.documents) {
        if (doc.summary) docSummaries.set(doc.id, doc.summary);
      }
    }

    const { positions, groups } = computeLayout(graphData.nodes, graphData.edges, docSummaries);

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

    // Detect newly added nodes (skip animation on initial load)
    const currentIds = new Set(computed.nodes.map((n) => n.id));
    let newIds: Set<string> | undefined;

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    } else {
      newIds = new Set<string>();
      for (const id of currentIds) {
        if (!knownNodeIdsRef.current.has(id)) {
          newIds.add(id);
        }
      }
      if (newIds.size === 0) newIds = undefined;
    }

    // Update known IDs
    knownNodeIdsRef.current = currentIds;

    applyFiltersAndSet(computed.nodes, computed.edges, computed.groups, newIds);

    // After animation completes, clear isNew flags and fit viewport
    if (newIds && newIds.size > 0) {
      const totalDuration = newIds.size * 60 + 500;
      const timer = setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.data?.isNew
              ? { ...n, data: { ...n.data, isNew: false }, style: { ...n.style, animationDelay: undefined } }
              : n,
          ),
        );
      }, totalDuration);

      const fitTimer = setTimeout(() => {
        flowInstanceRef.current?.fitView({
          padding: 0.1,
          minZoom: 0.05,
          maxZoom: 1,
          duration: 400,
        });
      }, newIds.size * 60 + 300);

      return () => {
        clearTimeout(timer);
        clearTimeout(fitTimer);
      };
    }
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
    groups: GroupBox[],
    newIds?: Set<string>,
  ) {
    const { flowNodes, flowEdges } = buildFilteredFlow(rawNodes, rawEdges, groups, newIds);
    filteredFlowRef.current = { nodes: flowNodes, edges: flowEdges };

    if (focusedNodeId) {
      applyFocus(focusedNodeId, flowNodes, flowEdges);
    } else {
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }

  function buildFilteredFlow(
    rawNodes: GraphNode[],
    rawEdges: GraphEdge[],
    groups: GroupBox[],
    newIds?: Set<string>,
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

    return {
      flowNodes: toFlowNodes(filteredNodes, groups, newIds),
      flowEdges: toFlowEdges(filteredEdges),
    };
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
          // flowToSource = true → particles travel target → source (reversed path).
          // Default: particles flow toward the focused node.
          // For "extends" edges, reverse the semantic direction — the base idea
          // flows into the extension, so particles should move the other way.
          const relType = (edge.data as Record<string, unknown> | undefined)?.relType as string | undefined;
          let flowToSource = connected && edge.source === nodeId;
          if (connected && relType === 'extends') flowToSource = !flowToSource;
          return {
            ...edge,
            data: {
              ...edge.data,
              showLabel: connected,
              animated: connected,
              flowToSource,
            },
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
        data: { ...e.data, showLabel: false, animated: false, flowToSource: false },
        style: { ...e.style, transition: 'opacity 0.2s ease' },
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

    // When search is cleared, restore default opacities without resetting positions.
    if (query === '') {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type === 'documentGroup') return node;
          return { ...node, style: { ...node.style, opacity: 1 } };
        }),
      );
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({ ...edge, style: { ...edge.style, opacity: 0.6 } })),
      );
      return;
    }

    setNodes((currentNodes) => {
      const matchingIds = new Set(
        currentNodes
          .filter((n) => n.type === 'idea' && nodeMatchesSearch(n.data as Record<string, unknown>, query))
          .map((n) => n.id),
      );

      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          const connected = matchingIds.has(edge.source) && matchingIds.has(edge.target);
          return { ...edge, style: { ...edge.style, opacity: connected ? 0.8 : 0.05 } };
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

  function handleResetLayout() {
    if (!computedRef.current) return;
    const { nodes: rawNodes, edges: rawEdges, groups } = computedRef.current;
    const { flowNodes, flowEdges } = buildFilteredFlow(rawNodes, rawEdges, groups);
    filteredFlowRef.current = { nodes: flowNodes, edges: flowEdges };
    setFocusedNodeId(null);
    setNodes(flowNodes);
    setEdges(flowEdges);
    flowInstanceRef.current?.fitView({ padding: 0.1, minZoom: 0.05, maxZoom: 1 });
  }

  if (graphData === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <AsciiLoader label="Loading graph" size="sm" />
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
        <button
          type="button"
          onClick={handleResetLayout}
          className="shrink-0 rounded border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset layout
        </button>
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
        minZoom={0.05}
        // Perf: disable interactions we don't use (edges/nodes are computed, not edited).
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
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
              reasoning: ed.reasoning as string | undefined,
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
            reasoning: d.reasoning as string | undefined,
            evidence: d.evidence as EdgeClickData['evidence'],
          });
        }}
        onPaneClick={() => {
          if (focusedNodeId) clearFocus();
        }}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.1, minZoom: 0.05, maxZoom: 1 }}
      >
        <Controls showInteractive={false} />
        {!isLargeGraph && (
          <MiniMap
            nodeColor="#1a1a1a"
            maskColor="rgba(0, 0, 0, 0.7)"
          />
        )}
        <Background color="#141414" />
      </ReactFlow>
    </div>
  );
}
