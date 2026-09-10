"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatEventDate, formatEventTime, toDateInputValue, toTimeInputValue } from "@/lib/date";
import { CULTURAL_SUB_CATEGORIES, parseSubCategories } from "@/lib/culturalSubCategories";
import type { EventRecord } from "@/lib/types";
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

type EventFormValues = {
  name: string;
  description: string;
  date: string;
  startTime: string;
  location: string;
  category: string;
  capacity: string;
  subCategories: string[];
};

/** Shared by "+ New Event" and "Edit" — keyed by the parent on the event's
 *  id (or "new") so switching which event is being edited remounts this
 *  with fresh initial state instead of carrying over the previous form's. */
function EventForm({
  event,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  event: EventRecord | null;
  onSubmit: (values: EventFormValues) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [category, setCategory] = useState(event?.category ?? "General");
  const [subCategories, setSubCategories] = useState<string[]>(parseSubCategories(event?.sub_categories));
  const isCultural = category === "Cultural";

  function toggleSubCategory(c: string) {
    setSubCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({
      name: String(form.get("name")),
      description: String(form.get("description") || ""),
      date: String(form.get("date")),
      startTime: String(form.get("startTime")),
      location: String(form.get("location")),
      category,
      capacity: String(form.get("capacity") || ""),
      subCategories,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <input
        name="name"
        required
        defaultValue={event?.name}
        placeholder="Event name"
        className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
      />
      <textarea
        name="description"
        defaultValue={event?.description}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="date"
          type="date"
          required
          defaultValue={event ? toDateInputValue(event.date) : undefined}
          className="rounded-lg border border-border px-3 py-2.5 text-sm"
        />
        <input
          name="startTime"
          type="time"
          required
          defaultValue={event ? toTimeInputValue(event.start_time) : undefined}
          className="rounded-lg border border-border px-3 py-2.5 text-sm"
        />
      </div>
      <input
        name="location"
        required
        defaultValue={event?.location}
        placeholder="Location"
        className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-border px-3 py-2.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          name="capacity"
          type="number"
          min={0}
          defaultValue={event?.capacity}
          placeholder="Capacity"
          className="rounded-lg border border-border px-3 py-2.5 text-sm"
        />
      </div>

      {isCultural && (
        <div className="space-y-1.5 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">
            Performance types offered
          </p>
          <div className="flex flex-wrap gap-3">
            {CULTURAL_SUB_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={subCategories.includes(c)} onChange={() => toggleSubCategory(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-maroon py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : event ? "Save Changes" : "Create as Draft"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function VolunteerEventsPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: events, loading, error: loadError } = useAsync(() => api.events.list(), [refreshKey]);
  const canCreate = volunteer?.permissions.includes("Events");

  function openCreateForm() {
    setEditingEvent(null);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(event: EventRecord) {
    setEditingEvent(event);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEvent(null);
    setError(null);
  }

  async function handleFormSubmit(values: EventFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description,
        date: values.date,
        startTime: values.startTime,
        location: values.location,
        category: values.category,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        subCategories: values.subCategories,
      };
      if (editingEvent) {
        await api.volunteer.updateEvent(idToken as string, editingEvent.event_id, payload);
      } else {
        await api.volunteer.createEvent(idToken as string, { ...payload, status: "DRAFT" });
      }
      closeForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(eventId: string, status: string) {
    setActionError(null);
    setActioning(eventId);
    try {
      await api.volunteer.updateEventStatus(idToken as string, eventId, status);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update event.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Events" subtitle="Manage festival events" />
        {canCreate && (
          <button
            onClick={() => (showForm ? closeForm() : openCreateForm())}
            className="shrink-0 rounded-lg bg-saffron px-3 py-2 text-xs font-semibold text-white active:bg-saffron-dark transition-colors"
          >
            {showForm ? "Cancel" : "+ New Event"}
          </button>
        )}
      </div>

      {showForm && (
        <EventForm
          key={editingEvent?.event_id ?? "new"}
          event={editingEvent}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
          submitting={submitting}
          error={error}
        />
      )}

      {loading && <p className="text-sm text-muted">Loading events…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

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
                  {formatEventDate(event.date)} · {formatEventTime(event.start_time)} · {event.location}
                </p>
              </div>
              <StatusBadge label={event.status} tone={STATUS_TONE[event.status] ?? "neutral"} />
            </div>
            <div className="flex items-center justify-end gap-2 flex-wrap">
              {canCreate && (
                <button
                  onClick={() => openEditForm(event)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
                >
                  Edit
                </button>
              )}
              {canCreate && (event.status === "DRAFT" || event.status === "CLOSED") && (
                <button
                  disabled={actioning === event.event_id}
                  onClick={() => handleStatusChange(event.event_id, "OPEN")}
                  className="rounded-lg bg-maroon px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Publish
                </button>
              )}
              {canCreate && (event.status === "OPEN" || event.status === "FULL") && (
                <button
                  disabled={actioning === event.event_id}
                  onClick={() => handleStatusChange(event.event_id, "CLOSED")}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                >
                  Close
                </button>
              )}
              {canCreate && event.status !== "CANCELLED" && event.status !== "COMPLETED" && (
                <button
                  disabled={actioning === event.event_id}
                  onClick={() => handleStatusChange(event.event_id, "CANCELLED")}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
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
