import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { GripVertical } from 'lucide-react';

type DocumentGroupData = {
  label: string;
  summary?: string;
  width: number;
  height: number;
};

export const DocumentGroup = memo(function DocumentGroup({ data, dragging }: NodeProps) {
  const { label, summary, width, height } = data as DocumentGroupData;

  return (
    <div
      style={{ width, height }}
      className={`rounded-lg border border-zinc-200/[0.18] bg-zinc-200/[0.08] backdrop-blur-lg shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_14px_48px_rgba(0,0,0,0.55)] ${
        dragging ? 'ring-1 ring-primary/30 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_30px_rgba(255,255,255,0.06)]' : ''
      }`}
    >
      <div className="doc-group__drag pointer-events-auto px-5 py-3.5 border-b border-zinc-200/[0.14] bg-zinc-200/[0.14] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-white/45 tracking-wide uppercase truncate">
            {label}
          </span>
          <GripVertical className="size-3.5 text-white/30" />
        </div>
      </div>
      {summary && (
        <div className="pointer-events-auto px-5 py-3 overflow-hidden bg-zinc-200/[0.12]" style={{ maxHeight: 108 }}>
          <p className="text-[10.5px] leading-[1.6] text-white/40 line-clamp-5">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
});
