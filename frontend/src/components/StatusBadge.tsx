const TONES = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-zinc-100 text-zinc-600",
} as const;

export type BadgeTone = keyof typeof TONES;

export default function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
