import Link from "next/link";

export default function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "← Home",
}: {
  title: string;
  subtitle?: string;
  /** When set, shows a small link above the title — e.g. back to a
   *  parent list or Home, for pages one level deeper than the main nav. */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="space-y-0.5">
      {backHref && (
        <Link href={backHref} className="block text-xs font-medium text-maroon">
          {backLabel}
        </Link>
      )}
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
