"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";

export default function VolunteerDinnerPage() {
  const { idToken } = useVolunteerAuth();
  const { data: events } = useAsync(() => api.events.list(), []);
  const dinnerDays = (events ?? []).filter((e) => e.category === "Dinner");

  const [eventId, setEventId] = useState<string | null>(null);
  const selected = eventId || dinnerDays[0]?.event_id || null;

  const { data: dashboard, loading, error } = useAsync(
    () => (selected ? api.volunteer.dinnerDashboard(idToken as string, selected) : Promise.resolve(null)),
    [idToken, selected]
  );

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Dinner" />

      {dinnerDays.length === 0 && (
        <p className="text-sm text-muted">No dinner days configured yet — add an Event with category &quot;Dinner&quot;.</p>
      )}

      {dinnerDays.length > 1 && (
        <select
          value={selected ?? ""}
          onChange={(e) => setEventId(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
        >
          {dinnerDays.map((d) => (
            <option key={d.event_id} value={d.event_id}>
              {d.name} — {d.date}
            </option>
          ))}
        </select>
      )}

      {selected && (
        <Link
          href="/volunteer/dinner/counter"
          className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white shadow-sm active:bg-saffron-dark transition-colors"
        >
          Open Dinner Counter
        </Link>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {dashboard && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile value={dashboard.allocated.toLocaleString()} label="Meals Registered" />
            <StatTile value={dashboard.served.toLocaleString()} label="Meals Served" />
            <StatTile value={dashboard.remaining.toLocaleString()} label="Meals Remaining" />
            <StatTile value={`${dashboard.utilization}%`} label="Utilization" />
          </div>

          {dashboard.capacity > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Capacity</span>
                <span>
                  {dashboard.allocated.toLocaleString()} / {dashboard.capacity.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-saffron"
                  style={{ width: `${Math.min(100, Math.round((dashboard.allocated / dashboard.capacity) * 100))}%` }}
                />
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Advance vs Walk-in</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <p>Advance registrations</p>
                <p className="font-semibold">{dashboard.advance.toLocaleString()}</p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <p>Walk-ins</p>
                <p className="font-semibold">{dashboard.walkIns.toLocaleString()}</p>
              </div>
            </div>
          </section>

          <Link
            href="/volunteer/dinner/walkin"
            className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon"
          >
            + New Walk-in Registration
          </Link>
        </>
      )}
    </div>
  );
}
