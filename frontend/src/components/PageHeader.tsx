export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="space-y-0.5">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
