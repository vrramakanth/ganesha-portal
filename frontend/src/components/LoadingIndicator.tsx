/** A small spinner alongside the existing "Loading…" text — several
 *  backend calls sit on Apps Script's fixed per-request overhead (see
 *  perf notes), so a plain static line can read as the page having
 *  stalled. A bit of motion signals "still working" instead. */
export default function LoadingIndicator({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <p className={`flex items-center gap-2 text-sm text-muted ${className}`}>
      <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-muted border-t-transparent" />
      {label}
    </p>
  );
}
