import { Handle, Position, type NodeProps } from '@xyflow/react';

type IdeaNodeData = {
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string }[];
};

export function IdeaNode({ data }: NodeProps) {
  const { label, tags } = data as IdeaNodeData;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white/30 !border-white/10 !w-1.5 !h-1.5"
      />
      <div className="w-[200px] rounded border border-white/[0.08] bg-[#0c0c0c] px-3 py-2 transition-colors hover:border-white/20">
        <p className="text-[11px] font-medium leading-snug text-foreground line-clamp-2">
          {label}
        </p>
        {tags.length > 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground truncate">
            {tags.map((t) => `#${t}`).join(' ')}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white/30 !border-white/10 !w-1.5 !h-1.5"
      />
    </>
  );
}
