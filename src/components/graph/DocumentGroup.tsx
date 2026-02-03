import { type NodeProps } from '@xyflow/react';

type DocumentGroupData = {
  label: string;
  width: number;
  height: number;
};

export function DocumentGroup({ data }: NodeProps) {
  const { label, width, height } = data as DocumentGroupData;

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
    </div>
  );
}
