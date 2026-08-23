"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";

const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: "success",
  FULL: "warning",
  DRAFT: "neutral",
  CLOSED: "neutral",
  CANCELLED: "danger",
  COMPLETED: "info",
};

const CATEGORIES = ["General", "Dinner", "Kids", "Cultural", "Sports"];

export default function VolunteerEventsPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: events, loading, error: loadError } = useAsync(() => api.events.list(), [refreshKey]);
  const canCreate = volunteer?.permissions.includes("Events");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.volunteer.createEvent(idToken as string, {
        name: String(form.get("name")),
        description: String(form.get("description") || ""),
        date: String(form.get("date")),
        startTime: String(form.get("startTime")),
        location: String(form.get("location")),
        category: String(form.get("category")),
        capacity: form.get("capacity") ? Number(form.get("capacity")) : undefined,
        status: "DRAFT",
      });
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Events" subtitle="Manage festival events" />
        {canCreate && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="shrink-0 rounded-lg bg-saffron px-3 py-2 text-xs font-semibold text-white active:bg-saffron-dark transition-colors"
          >
            {showForm ? "Cancel" : "+ New Event"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <input name="name" required placeholder="Event name" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          <textarea name="description" placeholder="Description (optional)" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input name="date" type="date" required className="rounded-lg border border-border px-3 py-2.5 text-sm" />
            <input name="startTime" type="time" required className="rounded-lg border border-border px-3 py-2.5 text-sm" />
          </div>
          <input name="location" required placeholder="Location" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="category" className="rounded-lg border border-border px-3 py-2.5 text-sm">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input name="capacity" type="number" min={0} placeholder="Capacity" className="rounded-lg border border-border px-3 py-2.5 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-maroon py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create as Draft"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-muted">Loading events…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(events ?? []).length === 0 && !loading && (
          <p className="px-4 py-3 text-sm text-muted">No events yet.</p>
        )}
        {(events ?? []).map((event) => (
          <div key={event.event_id} className="px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{event.name}</p>
                <p className="text-xs text-muted">
                  {event.date} · {event.start_time} · {event.location}
                </p>
              </div>
              <StatusBadge label={event.status} tone={STATUS_TONE[event.status] ?? "neutral"} />
            </div>
            <div className="flex items-center justify-end">
              <Link
                href={`/volunteer/events/checkin?event=${event.event_id}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-maroon"
              >
                Check-in
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
