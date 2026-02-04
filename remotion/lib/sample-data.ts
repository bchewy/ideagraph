export type SampleNode = {
  id: string;
  label: string;
  tags: string[];
  summary: string;
  documentId: string;
  x: number;
  y: number;
};

export type SampleEdge = {
  id: string;
  source: string;
  target: string;
  relType: string;
  confidence: number;
  reasoning: string;
};

export type SampleDocument = {
  id: string;
  filename: string;
};

export const DOCUMENTS: SampleDocument[] = [
  { id: 'doc1', filename: 'attention-mechanisms.pdf' },
  { id: 'doc2', filename: 'neural-scaling-laws.pdf' },
  { id: 'doc3', filename: 'knowledge-distillation.pdf' },
];

export const NODES: SampleNode[] = [
  // Document 1 cluster
  {
    id: 'n1',
    label: 'Self-attention enables parallel sequence processing',
    tags: ['transformers', 'attention'],
    summary: 'Self-attention mechanisms allow models to process all positions in a sequence simultaneously.',
    documentId: 'doc1',
    x: 120,
    y: 100,
  },
  {
    id: 'n2',
    label: 'Multi-head attention captures diverse relationships',
    tags: ['attention', 'architecture'],
    summary: 'Multiple attention heads can learn different types of relationships between tokens.',
    documentId: 'doc1',
    x: 120,
    y: 200,
  },
  {
    id: 'n3',
    label: 'Positional encoding preserves sequence order',
    tags: ['transformers', 'encoding'],
    summary: 'Since attention is permutation-invariant, positional encodings are added to retain order information.',
    documentId: 'doc1',
    x: 120,
    y: 300,
  },
  {
    id: 'n4',
    label: 'Cross-attention bridges encoder and decoder',
    tags: ['attention', 'seq2seq'],
    summary: 'Cross-attention allows decoder to attend to encoder outputs for sequence-to-sequence tasks.',
    documentId: 'doc1',
    x: 120,
    y: 400,
  },

  // Document 2 cluster
  {
    id: 'n5',
    label: 'Scaling compute improves model performance predictably',
    tags: ['scaling', 'compute'],
    summary: 'Loss decreases as a power law with increased compute budget.',
    documentId: 'doc2',
    x: 520,
    y: 100,
  },
  {
    id: 'n6',
    label: 'Data quality matters more than quantity at scale',
    tags: ['scaling', 'data'],
    summary: 'Beyond a threshold, data quality has larger impact on performance than additional data volume.',
    documentId: 'doc2',
    x: 520,
    y: 200,
  },
  {
    id: 'n7',
    label: 'Emergent abilities appear at critical model sizes',
    tags: ['scaling', 'emergence'],
    summary: 'Certain capabilities like reasoning only emerge beyond specific parameter count thresholds.',
    documentId: 'doc2',
    x: 520,
    y: 300,
  },
  {
    id: 'n8',
    label: 'Chinchilla optimal: balance params and tokens',
    tags: ['scaling', 'efficiency'],
    summary: 'Optimal training requires matching parameter count to training token count.',
    documentId: 'doc2',
    x: 520,
    y: 400,
  },

  // Document 3 cluster
  {
    id: 'n9',
    label: 'Knowledge distillation transfers learned representations',
    tags: ['distillation', 'compression'],
    summary: 'Student models can learn from teacher model soft labels to achieve competitive performance.',
    documentId: 'doc3',
    x: 920,
    y: 100,
  },
  {
    id: 'n10',
    label: 'Temperature scaling controls knowledge transfer softness',
    tags: ['distillation', 'hyperparameters'],
    summary: 'Higher temperature produces softer probability distributions that reveal inter-class similarities.',
    documentId: 'doc3',
    x: 920,
    y: 200,
  },
  {
    id: 'n11',
    label: 'Layer-wise distillation preserves intermediate features',
    tags: ['distillation', 'features'],
    summary: 'Matching intermediate layer representations improves student model quality.',
    documentId: 'doc3',
    x: 920,
    y: 300,
  },
  {
    id: 'n12',
    label: 'Quantization-aware distillation enables edge deployment',
    tags: ['distillation', 'deployment'],
    summary: 'Combining distillation with quantization produces models suitable for resource-constrained devices.',
    documentId: 'doc3',
    x: 920,
    y: 400,
  },
];

export const EDGES: SampleEdge[] = [
  {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    relType: 'extends',
    confidence: 0.92,
    reasoning: 'Multi-head attention is a direct extension of the self-attention mechanism.',
  },
  {
    id: 'e2',
    source: 'n1',
    target: 'n3',
    relType: 'depends_on',
    confidence: 0.88,
    reasoning: 'Self-attention requires positional encoding to handle sequence order.',
  },
  {
    id: 'e3',
    source: 'n2',
    target: 'n4',
    relType: 'extends',
    confidence: 0.85,
    reasoning: 'Cross-attention extends multi-head attention to bridge encoder-decoder.',
  },
  {
    id: 'e4',
    source: 'n5',
    target: 'n7',
    relType: 'supports',
    confidence: 0.91,
    reasoning: 'Scaling compute is what leads to emergent abilities at critical sizes.',
  },
  {
    id: 'e5',
    source: 'n6',
    target: 'n8',
    relType: 'supports',
    confidence: 0.87,
    reasoning: 'Data quality concerns directly motivate Chinchilla-optimal training.',
  },
  {
    id: 'e6',
    source: 'n1',
    target: 'n5',
    relType: 'similar',
    confidence: 0.72,
    reasoning: 'Both address foundational transformer architecture scaling properties.',
  },
  {
    id: 'e7',
    source: 'n7',
    target: 'n9',
    relType: 'contradicts',
    confidence: 0.68,
    reasoning: 'Emergent abilities from scale may not transfer well through distillation.',
  },
  {
    id: 'e8',
    source: 'n5',
    target: 'n9',
    relType: 'extends',
    confidence: 0.76,
    reasoning: 'Distillation provides a way to compress the benefits of scaling.',
  },
  {
    id: 'e9',
    source: 'n10',
    target: 'n11',
    relType: 'supports',
    confidence: 0.83,
    reasoning: 'Temperature scaling enhances the effectiveness of layer-wise distillation.',
  },
  {
    id: 'e10',
    source: 'n11',
    target: 'n12',
    relType: 'extends',
    confidence: 0.79,
    reasoning: 'Quantization-aware methods build upon layer-wise distillation techniques.',
  },
  {
    id: 'e11',
    source: 'n8',
    target: 'n12',
    relType: 'example_of',
    confidence: 0.65,
    reasoning: 'Edge deployment demonstrates practical application of efficiency-focused scaling.',
  },
  {
    id: 'e12',
    source: 'n3',
    target: 'n6',
    relType: 'similar',
    confidence: 0.58,
    reasoning: 'Both deal with information encoding considerations in deep learning.',
  },
];

export const INSPECTOR_NODE = NODES[0];
export const INSPECTOR_CONNECTIONS = [
  { label: NODES[1].label, relType: 'extends', confidence: 0.92 },
  { label: NODES[2].label, relType: 'depends_on', confidence: 0.88 },
  { label: NODES[4].label, relType: 'similar', confidence: 0.72 },
];
export const INSPECTOR_EVIDENCE = [
  { filename: 'attention-mechanisms.pdf', excerpt: 'Self-attention computes a weighted sum of all positions, enabling parallel processing of the entire sequence.' },
  { filename: 'attention-mechanisms.pdf', excerpt: 'The key innovation is replacing recurrence with attention, allowing O(1) sequential operations.' },
];
