"use client";

import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import type { EventRegistration } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LoadingIndicator from "@/components/LoadingIndicator";

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Pending",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};
const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING_REVIEW: "warning",
  CONFIRMED: "success",
  REJECTED: "danger",
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** A curated, human-readable export — deliberately not the raw sheet
 *  columns (resident_id, reviewed_by, timestamps, …), just what an
 *  organizer actually wants to scan or print for event-day planning. */
function buildReportCsv(registrations: EventRegistration[], eventNameById: Map<string, string>): string {
  const headers = ["Event", "Participant", "Age", "Block", "Flat", "Mobile", "Type", "Status", "Song"];
  const rows = registrations.map((r) => [
    eventNameById.get(r.event_id) ?? r.event_id,
    r.participant_name,
    r.participant_age || "",
    r.block,
    r.flat_number,
    r.mobile,
    r.sub_category || "",
    STATUS_LABEL[r.status] ?? r.status,
    r.song_url ? "Yes" : "No",
  ]);
  return [headers, ...rows].map((row) => row.map((v) => csvEscape(String(v))).join(",")).join("\n");
}

function confirmationMessage(r: EventRegistration, eventName: string): string {
  const type = r.sub_category ? ` (${r.sub_category})` : "";
  return `Hi ${r.participant_name}! Your nomination for "${eventName}"${type} has been confirmed. Registration ID: ${r.registration_id}. See you there! 🙏`;
}

/** A warm, appreciative decline rather than a blunt "rejected" — frames
 *  it as high interest/limited slots and invites them to other events,
 *  same spirit as the Seva "reschedule" message. */
function rejectionMessage(r: EventRegistration, eventName: string): string {
  const type = r.sub_category ? ` for ${r.sub_category}` : "";
  return `Hi ${r.participant_name}! Thank you so much for your interest in "${eventName}"${type}. We had a wonderful response and couldn't accommodate every nomination this time — we're sorry we can't include you for this one. We'd love to see you at our other Ganesha Chathurthi 2026 events! 🙏`;
}

export default function EventRegistrationsPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const canReview = volunteer?.permissions.includes("Events");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ mobile: string; message: string } | null>(null);
  const [confirmDraft, setConfirmDraft] = useState("");

  const { data, loading, error: loadError } = useAsync(
    () =>
      Promise.all([
        api.volunteer.pendingRegistrations(idToken as string),
        api.volunteer.allRegistrations(idToken as string),
        api.events.list(),
      ]),
    [idToken, refreshKey]
  );
  const [registrations, allRegistrations, events] = data ?? [[], [], []];

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((e) => map.set(e.event_id, e.name));
    return map;
  }, [events]);

  const sortedReport = useMemo(
    () =>
      [...allRegistrations].sort((a, b) => {
        const eventCompare = (eventNameById.get(a.event_id) ?? "").localeCompare(eventNameById.get(b.event_id) ?? "");
        return eventCompare !== 0 ? eventCompare : a.participant_name.localeCompare(b.participant_name);
      }),
    [allRegistrations, eventNameById]
  );

  function downloadReport() {
    const csv = buildReportCsv(sortedReport, eventNameById);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "event-registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Approving takes effect immediately regardless of whether a
   *  confirmation gets sent — the WhatsApp step below is a courtesy on
   *  top, not a gate, same as the Seva approval flow. */
  async function approve(r: EventRegistration) {
    setError(null);
    setBusyId(r.registration_id);
    try {
      await api.volunteer.approveRegistration(idToken as string, r.registration_id);
      const eventName = eventNameById.get(r.event_id) ?? "the event";
      const message = confirmationMessage(r, eventName);
      setConfirmation({ mobile: r.mobile, message });
      setConfirmDraft(message);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not approve.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(r: EventRegistration) {
    setError(null);
    setBusyId(r.registration_id);
    try {
      await api.volunteer.rejectRegistration(idToken as string, r.registration_id);
      const eventName = eventNameById.get(r.event_id) ?? "the event";
      const message = rejectionMessage(r, eventName);
      setConfirmation({ mobile: r.mobile, message });
      setConfirmDraft(message);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not reject.");
    } finally {
      setBusyId(null);
    }
  }

  function sendConfirmation() {
    if (!confirmation) return;
    window.open(`https://wa.me/91${confirmation.mobile}?text=${encodeURIComponent(confirmDraft)}`, "_blank");
    setConfirmation(null);
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Event Nominations" subtitle="Review pending registrations" backHref="/volunteer/events" backLabel="← Events" />

      {loading && <LoadingIndicator />}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {confirmation && (
        <section className="space-y-2 rounded-xl border border-maroon/30 bg-maroon/5 p-4">
          <p className="text-sm font-semibold text-maroon">Send them a message?</p>
          <textarea
            value={confirmDraft}
            onChange={(e) => setConfirmDraft(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendConfirmation}
              className="flex-1 rounded-lg bg-maroon py-2 text-center text-xs font-semibold text-white"
            >
              Send via WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
            >
              Skip
            </button>
          </div>
        </section>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {registrations.length === 0 && !loading && (
          <p className="px-4 py-3 text-sm text-muted">No nominations awaiting review.</p>
        )}
        {registrations.map((r) => (
          <div key={r.registration_id} className="px-4 py-3 space-y-2">
            <div>
              <p className="font-semibold text-sm">{r.participant_name}</p>
              <p className="text-xs text-muted">
                {eventNameById.get(r.event_id) ?? r.event_id}
                {r.sub_category ? ` · ${r.sub_category}` : ""}
              </p>
              <p className="text-xs text-muted">
                Block {r.block}, Flat {r.flat_number} · {r.mobile}
                {r.participant_age ? ` · Age ${r.participant_age}` : ""}
              </p>
              {r.song_url && (
                <a
                  href={r.song_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-maroon underline"
                >
                  🎵 Play song
                </a>
              )}
            </div>
            {canReview && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.registration_id}
                  onClick={() => approve(r)}
                  className="flex-1 rounded-lg bg-maroon py-2 text-center text-xs font-semibold text-white disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === r.registration_id}
                  onClick={() => reject(r)}
                  className="flex-1 rounded-lg border border-border py-2 text-center text-xs font-semibold text-red-600 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Participant Report</h2>
            <p className="text-xs text-muted">{sortedReport.length} total nominations across every event</p>
          </div>
          <button
            type="button"
            onClick={downloadReport}
            disabled={sortedReport.length === 0}
            className="shrink-0 rounded-lg bg-saffron px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            Download CSV
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {sortedReport.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm text-muted">No one has registered for an event yet.</p>
          )}
          {sortedReport.map((r) => (
            <div key={r.registration_id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{r.participant_name}</p>
                <p className="text-xs text-muted">
                  {eventNameById.get(r.event_id) ?? r.event_id}
                  {r.sub_category ? ` · ${r.sub_category}` : ""}
                </p>
                <p className="text-xs text-muted">
                  Block {r.block}, Flat {r.flat_number} · {r.mobile}
                  {r.participant_age ? ` · Age ${r.participant_age}` : ""}
                </p>
              </div>
              <StatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "neutral"} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
