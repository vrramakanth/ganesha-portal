"use client";

const ALLOWED_BLOCKS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S"];

export default function BlockSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (block: string) => void;
}) {
  return (
    <div>
      <input
        required
        value={value}
        maxLength={1}
        placeholder="e.g. A"
        onChange={(e) => {
          const letter = e.target.value.trim().toUpperCase().slice(-1);
          if (letter === "" || ALLOWED_BLOCKS.includes(letter)) onChange(letter);
        }}
        className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm uppercase"
      />
      <p className="mt-1 text-xs text-muted">Allowed blocks: {ALLOWED_BLOCKS.join(", ")}</p>
    </div>
  );
}
