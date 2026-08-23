import Link from "next/link";
import PageHeader from "@/components/PageHeader";

const links = [
  { href: "/volunteer/reports", label: "Reports", description: "Finance, events, dinner and volunteer reports" },
  { href: "/volunteer/announcements", label: "Announcements", description: "Publish updates residents see on Home" },
  { href: "/volunteer/settings", label: "Settings", description: "Festival configuration" },
  { href: "/volunteer/audit-log", label: "Audit Log", description: "History of sensitive volunteer actions" },
];

export default function VolunteerMorePage() {
  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="More" />

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between gap-2 px-4 py-3.5"
          >
            <div>
              <p className="font-semibold text-sm">{link.label}</p>
              <p className="text-xs text-muted">{link.description}</p>
            </div>
            <span className="text-muted">›</span>
          </Link>
        ))}
      </div>

      <Link href="/" className="text-center text-xs text-muted underline">
        Switch to Resident View
      </Link>
    </div>
  );
}
