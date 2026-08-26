"use client";

export default function MobileInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (mobile: string) => void;
}) {
  return (
    <input
      required
      type="tel"
      value={value}
      maxLength={10}
      inputMode="numeric"
      pattern="[6-9]\d{9}"
      title="10-digit mobile number, e.g. 9876543210"
      placeholder="e.g. 9876543210"
      autoComplete="off"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        onChange(digits);
      }}
      className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
    />
  );
}
