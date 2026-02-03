'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
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
    data: {
      relType: e.type,
      confidence: e.confidence,
      evidence: e.evidence,
    },
    label: e.type,
  }));
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, { projectId: string }>(
  function GraphCanvas({ projectId }, ref) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

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
          const flowEdges = toFlowEdges(data.edges);
          const flowNodes = toFlowNodes(data.nodes);
          setNodes(flowNodes);
          setEdges(flowEdges);
          setLoading(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.error('Graph fetch error:', err);
          setLoading(false);
        });

      return () => controller.abort();
    }, [projectId, refreshKey, setNodes, setEdges]);

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    );
  }
);
