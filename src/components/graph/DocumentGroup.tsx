import { type NodeProps } from '@xyflow/react';

type DocumentGroupData = {
  label: string;
  summary?: string;
  width: number;
  height: number;
};

export function DocumentGroup({ data }: NodeProps) {
  const { label, summary, width, height } = data as DocumentGroupData;

  return (
    <div
      style={{ width, height }}
      className="rounded-lg border border-white/[0.06] bg-white/[0.02]"
    >
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <span className="text-[11px] font-medium text-white/30 tracking-wide uppercase">
          {label}
        </span>
      </div>
      {summary && (
        <div className="px-5 py-3 overflow-hidden" style={{ maxHeight: 108 }}>
          <p className="text-[10.5px] leading-[1.6] text-white/30 line-clamp-5">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
}
