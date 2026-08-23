"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import StatusBadge from "@/components/StatusBadge";

const STATUS_TONE = {
  OPEN: "success",
  FULL: "warning",
  DRAFT: "neutral",
  CLOSED: "neutral",
  CANCELLED: "danger",
  COMPLETED: "info",
} as const;

export default function EventsPage() {
  const { data: events, loading, error } = useAsync(() => api.events.list(), []);
  const visible = (events ?? []).filter((e) => e.status !== "DRAFT");

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <h1 className="text-xl font-bold">Events</h1>

      {loading && <p className="text-sm text-muted">Loading events…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && visible.length === 0 && (
        <p className="text-sm text-muted">No events published yet.</p>
      )}

      <div className="space-y-3">
        {visible.map((event) => (
          <Link
            key={event.event_id}
            href={`/events/${event.event_id}`}
            className="block rounded-xl border border-border bg-card p-4 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{event.name}</p>
              <StatusBadge label={event.status} tone={STATUS_TONE[event.status]} />
            </div>
            <p className="text-sm text-muted">
              {event.date} · {event.start_time} · {event.location}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
