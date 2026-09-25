"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

export default function GuestsPage() {
  const { data: guests, loading, error } = useAsync(() => api.guests.list(), []);

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Chief Guests" backHref="/more" backLabel="← More" />

      {loading && <LoadingIndicator />}
      {error && <p className="text-sm text-red-600">Couldn&apos;t load the guest list — please try again shortly.</p>}
      {!loading && !error && (guests ?? []).length === 0 && (
        <p className="text-sm text-muted">No guests announced yet.</p>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(guests ?? []).map((g) => (
          <div key={g.guest_id} className="px-4 py-3 flex items-center gap-3">
            {g.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.photo_url} alt={g.name} className="h-12 w-12 rounded-full object-cover border border-border" />
            )}
            <div>
              <p className="font-semibold text-sm">{g.name}</p>
              {g.title && <p className="text-xs text-muted">{g.title}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
