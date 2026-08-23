"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

export default function BlockSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (block: string) => void;
}) {
  const { data: blocks, loading } = useAsync(() => api.blocks.list(), []);

  return (
    <select
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
    >
      <option value="" disabled>
        {loading ? "Loading blocks…" : "Select block"}
      </option>
      {(blocks ?? []).map((b) => (
        <option key={b.block_id} value={b.block_name}>
          {b.block_name}
        </option>
      ))}
    </select>
  );
}
