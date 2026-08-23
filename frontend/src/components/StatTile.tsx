export default function StatTile({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-xl font-bold text-maroon">{value}</p>
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
    </div>
  );
}
