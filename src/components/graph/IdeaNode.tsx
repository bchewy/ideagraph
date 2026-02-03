import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';

type IdeaNodeData = {
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string }[];
};

export function IdeaNode({ data }: NodeProps) {
  const { label, tags, sources } = data as IdeaNodeData;

  const uniqueFilenames = [...new Set(sources.map((s) => s.filename))];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className="min-w-[180px] max-w-[260px] rounded-lg border border-border bg-card px-3 py-2 shadow-md">
        <p className="text-sm font-semibold leading-snug text-card-foreground">
          {label}
        </p>

        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {uniqueFilenames.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {uniqueFilenames.map((filename) => (
              <Badge
                key={filename}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {filename}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
