"use client";

import { useMemo } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import LoadingIndicator from "@/components/LoadingIndicator";
import PageHeader from "@/components/PageHeader";
import { formatEventDate } from "@/lib/date";
import { overallTotals, summariseEvents, type EventSummaryRow } from "@/lib/eventSummary";

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-xl font-bold text-maroon">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

/** Sign-ups per day as small bars, so a rush on the last day is easy to see. */
function DayBars({ row }: { row: EventSummaryRow }) {
  if (row.byDay.length === 0) return null;
  const max = Math.max(...row.byDay.map((d) => d.count));
  return (
    <div>
      <div className="flex h-12 items-end gap-0.5" role="img" aria-label="Sign-ups per day">
        {row.byDay.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.count}`}
            className="min-w-[3px] flex-1 rounded-t bg-saffron"
            style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{row.byDay[0].day}</span>
        <span>{row.byDay[row.byDay.length - 1].day}</span>
      </div>
    </div>
  );
}

function EventCard({ row }: { row: EventSummaryRow }) {
  const { event: e } = row;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{e.name}</p>
          <p className="text-xs text-muted">
            {formatEventDate(e.date)} · {e.category} · {e.status.toLowerCase()}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-2xl font-bold text-maroon">{row.signups}</span>
          <span className="text-[11px] text-muted">sign-ups</span>
        </p>
      </div>

      {row.signups === 0 ? (
        <p className="text-xs text-muted">No sign-ups yet.</p>
      ) : (
        <>
          <p className="text-xs">
            <span className="font-semibold text-green-700">{row.confirmed} confirmed</span>
            {row.pending > 0 && <span className="font-semibold text-amber-700"> · {row.pending} waiting</span>}
            {row.rejected > 0 && <span className="text-muted"> · {row.rejected} rejected</span>}
            {row.cancelled > 0 && <span className="text-muted"> · {row.cancelled} cancelled</span>}
            {row.checkedIn > 0 && <span className="text-muted"> · {row.checkedIn} checked in</span>}
          </p>
          <p className="text-xs text-muted">
            {row.people} {row.people === 1 ? "person" : "people"} from {row.homes} {row.homes === 1 ? "home" : "homes"}
            {row.returning > 0 && ` · ${row.returning} also joined another event`}
          </p>
          <DayBars row={row} />
          {row.lastTwoDaysPct !== null && (
            <p className="text-xs">
              <span className="font-semibold">{row.lastTwoDaysPct}%</span> signed up in the last 2 days before the event
            </p>
          )}
          {row.topBlocks.length > 0 && (
            <p className="text-xs text-muted">
              Most from: {row.topBlocks.map((b) => `Block ${b.block} (${b.count})`).join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** One card per event with how many signed up, how they arrived over time and
 *  who comes back, built from the registrations the admin already loads. It
 *  counts sign-ups, not page visits (Vercel Analytics has those). */
export default function EventsSummaryPage() {
  const { idToken } = useVolunteerAuth();
  const { data, loading, error } = useAsync(
    () => Promise.all([api.volunteer.allRegistrations(idToken as string), api.events.list()]),
    [idToken]
  );
  const [registrations, events] = data ?? [[], []];

  const rows = useMemo(
    () =>
      summariseEvents(events, registrations).sort(
        (a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime()
      ),
    [events, registrations]
  );
  const totals = useMemo(() => overallTotals(registrations), [registrations]);

  if (loading) return <LoadingIndicator label="Counting sign-ups…" className="px-5 pt-8" />;
  if (error) return <p className="px-5 pt-8 text-sm text-red-600">{error}</p>;

  return (
    <div className="flex flex-col gap-4 px-5 pt-6">
      <PageHeader title="Events summary" subtitle="Sign-ups across all events" backHref="/volunteer/events" backLabel="← Events" />
      <div className="grid grid-cols-2 gap-2">
        <Tile value={totals.signups} label="Sign-ups (not cancelled or rejected)" />
        <Tile value={totals.people} label="Different people" />
        <Tile value={totals.homes} label="Different homes" />
        <Tile value={totals.multiEvent} label="Joined 2+ events" />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">There are no events yet.</p>
      ) : (
        rows.map((row) => <EventCard key={row.event.event_id} row={row} />)
      )}
      <p className="text-xs text-muted">
        This counts sign-ups, not people who only looked at a page. For page visits, turn on Vercel Web Analytics.
      </p>
    </div>
  );
}
