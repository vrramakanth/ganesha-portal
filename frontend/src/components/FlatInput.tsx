"use client";

export default function FlatInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (flatNumber: string) => void;
}) {
  return (
    <div>
      <input
        required
        value={value}
        maxLength={3}
        inputMode="numeric"
        pattern="\d{3}"
        title="3-digit flat number, e.g. 005 for flat 5"
        placeholder="e.g. 005"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
          onChange(digits);
        }}
        className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
      />
    </div>
  );
}
