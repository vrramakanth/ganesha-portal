"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import PageHeader from "@/components/PageHeader";

export default function MorePage() {
  const { data, loading, error } = useAsync(
    () => Promise.all([api.festival.get(), api.announcements.list()]),
    []
  );
  const [festival, announcements] = data ?? [null, null];

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="More" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {festival && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
            Festival Information
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            <InfoRow label="Festival" value={festival.festival_name} />
            <InfoRow label="Dates" value={festival.dates} />
            <InfoRow label="Venue" value={festival.venue} />
            <InfoRow label="Contact" value={festival.contact} />
          </div>
        </section>
      )}

      {announcements && announcements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
            Announcements
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {announcements.map((a) => (
              <div key={a.announcement_id} className="px-4 py-3 space-y-1">
                <p className="font-semibold text-sm">{a.title}</p>
                <p className="text-xs text-muted">{a.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
          Need Help?
        </h2>
        <a
          href="/docs/user-guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3.5"
        >
          <div>
            <p className="font-semibold text-sm">How-To Guide</p>
            <p className="text-xs text-muted">Donating, events, dinner tokens &amp; more</p>
          </div>
          <span className="text-muted">›</span>
        </a>
      </section>

      <Link
        href="/volunteer-signup"
        className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white active:bg-maroon-dark transition-colors"
      >
        I Want to Volunteer
      </Link>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-sm font-medium text-right">{value}</p>
    </div>
  );
}
