import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

type IdeaNodeData = {
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string }[];
  isNew?: boolean;
};

export const IdeaNode = memo(function IdeaNode({ data }: NodeProps) {
  const { label, tags, isNew } = data as IdeaNodeData;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white/30 !border-white/10 !w-1.5 !h-1.5"
      />
      <div
        className={cn(
          'w-[200px] rounded border border-zinc-200/[0.22] bg-zinc-200/[0.12] px-3 py-2 backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.55)] transition-colors hover:border-zinc-200/[0.30]',
          isNew && 'animate-node-enter',
        )}
      >
        <p className="text-[11px] font-medium leading-snug text-foreground">
          {label}
        </p>
        {tags.length > 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
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
});
