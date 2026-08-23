"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatCurrency, formatEventWhen } from "@/lib/date";

export default function Home() {
  const { data, loading, error } = useAsync(
    () => Promise.all([api.stats.public(), api.events.list()]),
    []
  );

  const [stats, events] = data ?? [null, null];
  const upcoming = (events ?? [])
    .filter((e) => e.status === "OPEN")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 2);
  const dinnerEvent = (events ?? []).find((e) => e.category === "Dinner" && e.status === "OPEN");

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <header className="text-center space-y-1">
        <p className="text-sm font-semibold tracking-widest text-maroon uppercase">
          Brigade Woods
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Ganesha Chathurthi 2026
        </h1>
        <p className="text-muted text-sm">Celebrate. Participate. Contribute.</p>
      </header>

      <Link
        href="/donate"
        className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white shadow-sm active:bg-saffron-dark transition-colors"
      >
        Donate Now
      </Link>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-5 text-center">
        {error ? (
          <p className="text-sm text-muted py-2">Unable to load collection totals.</p>
        ) : loading || !stats ? (
          <p className="text-sm text-muted py-2">Loading collection totals…</p>
        ) : (
          <>
            <p className="text-3xl font-bold text-maroon">{formatCurrency(stats.totalCollected)}</p>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Collected</p>
            <p className="mt-2 text-sm text-foreground">{stats.families} families participating</p>
          </>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
          Upcoming
        </h2>
        {!loading && upcoming.length === 0 && (
          <p className="text-sm text-muted">No upcoming events yet.</p>
        )}
        <div className="space-y-2">
          {upcoming.map((event) => (
            <div
              key={event.event_id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-xs font-medium text-saffron">{formatEventWhen(event.date)}</p>
                <p className="font-semibold">{event.name}</p>
              </div>
              <p className="text-sm text-muted">{event.start_time}</p>
            </div>
          ))}
        </div>
        <Link
          href="/events"
          className="block w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon"
        >
          View All Events
        </Link>
      </section>

      {dinnerEvent && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <p className="font-semibold">{dinnerEvent.name}</p>
            <p className="text-sm text-muted">Registrations open</p>
          </div>
          <Link
            href="/dinner"
            className="block w-full rounded-xl bg-maroon py-3 text-center font-semibold text-white active:bg-maroon-dark transition-colors"
          >
            Register
          </Link>
        </section>
      )}
    </div>
  );
}
