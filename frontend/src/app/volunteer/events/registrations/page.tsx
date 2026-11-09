"use client";

import StallPaymentControl from "@/components/StallPaymentControl";
import StallDetails from "@/components/StallDetails";
import { parseStallNeeds, summariseStalls } from "@/lib/stallNeeds";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";
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
  const headers = ["Event", "Participant", "Age", "Block", "Flat", "Mobile", "Type", "Status", "Song", "Tables", "Chairs", "Power", "Amount due", "Payment ref", "Details"];
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
    stallNeedsCells(r.comments),
  ].flat());
  return [headers, ...rows].map((row) => row.map((v) => csvEscape(String(v))).join(",")).join("\n");
}

/** Tables, chairs, power and the free-text details, for stall sign-ups;
 *  other registrations keep their comments in the last column only. */
function stallNeedsCells(comments: string | undefined): string[] {
  const needs = parseStallNeeds(comments);
  if (!needs) return ["", "", "", "", "", (comments ?? "").replace(/\s*\n\s*/g, " | ")];
  return [
    String(needs.tables),
    String(needs.chairs),
    needs.power ? `Yes${needs.powerDetails ? `: ${needs.powerDetails}` : ""}` : "No",
    needs.fee ? String(needs.fee) : "",
    needs.paymentRef,
    [needs.idea, needs.other && `Other: ${needs.other}`].filter(Boolean).join(" | "),
  ];
}

function confirmationMessage(r: EventRegistration, eventName: string): string {
  const type = r.sub_category ? ` (${r.sub_category})` : "";
  return `Hi ${r.participant_name}! Your nomination for "${eventName}"${type} has been confirmed. Registration ID: ${r.registration_id}. See you there! 🙏`;
}

/** A warm, appreciative decline rather than a blunt "rejected" — frames
 *  it as high interest/limited slots and invites them to other events,
 *  same spirit as the Seva "reschedule" message. */
function rejectionMessage(r: EventRegistration, eventName: string, festivalName: string): string {
  const type = r.sub_category ? ` for ${r.sub_category}` : "";
  return `Hi ${r.participant_name}! Thank you so much for your interest in "${eventName}"${type}. We had a wonderful response and couldn't accommodate every nomination this time — we're sorry we can't include you for this one. We'd love to see you at our other ${festivalName ? `${festivalName} ` : ""}events! 🙏`;
}

export default function EventRegistrationsPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const { festival } = useFestivalConfig();
  const festivalName = festival?.festival_name ?? "";
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

  // Which event the admin is looking at ("" = all), kept in the address as
  // ?event=<id> so one event's reviewers can bookmark or be sent a link that
  // opens straight on theirs.
  const [eventFilter, setEventFilter] = useState(() =>
    typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("event") ?? "")
  );
  function chooseEvent(id: string) {
    setEventFilter(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("event", id);
    else url.searchParams.delete("event");
    window.history.replaceState(null, "", url.toString());
  }

  /** One chip per event that has any nomination, with how many await review. */
  const eventChips = useMemo(() => {
    const chips = new Map<string, { id: string; name: string; pending: number; total: number }>();
    allRegistrations.forEach((r) => {
      const chip = chips.get(r.event_id) ?? {
        id: r.event_id,
        name: eventNameById.get(r.event_id) ?? r.event_id,
        pending: 0,
        total: 0,
      };
      chip.total += 1;
      if (r.status === "PENDING_REVIEW") chip.pending += 1;
      chips.set(r.event_id, chip);
    });
    return [...chips.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allRegistrations, eventNameById]);

  const shownPending = useMemo(
    () => registrations.filter((r) => !eventFilter || r.event_id === eventFilter),
    [registrations, eventFilter]
  );
  /** The pending list, one group per event so each event's admins find theirs. */
  const pendingGroups = useMemo(() => {
    const groups = new Map<string, EventRegistration[]>();
    shownPending.forEach((r) => groups.set(r.event_id, [...(groups.get(r.event_id) ?? []), r]));
    return [...groups.entries()]
      .map(([id, list]) => ({ id, name: eventNameById.get(id) ?? id, list }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shownPending, eventNameById]);

  const sortedReport = useMemo(
    () =>
      allRegistrations
        .filter((r) => !eventFilter || r.event_id === eventFilter)
        .sort((a, b) => {
        const eventCompare = (eventNameById.get(a.event_id) ?? "").localeCompare(eventNameById.get(b.event_id) ?? "");
        return eventCompare !== 0 ? eventCompare : a.participant_name.localeCompare(b.participant_name);
      }),
    [allRegistrations, eventNameById, eventFilter]
  );

  const stallEventIds = useMemo(
    () => new Set(events.filter((e) => e.category === "Kids Stall").map((e) => e.event_id)),
    [events]
  );

  /** Confirmed stall sign-ups, with everything an organiser needs to set them up. */
  const approvedStalls = useMemo(
    () =>
      allRegistrations
        .filter((r) => r.status === "CONFIRMED" && (!eventFilter || r.event_id === eventFilter) && stallEventIds.has(r.event_id))
        .sort((a, b) => {
          const byEvent = (eventNameById.get(a.event_id) ?? "").localeCompare(eventNameById.get(b.event_id) ?? "");
          return byEvent !== 0 ? byEvent : a.participant_name.localeCompare(b.participant_name);
        }),
    [allRegistrations, eventFilter, eventNameById, stallEventIds]
  );
  const approvedWithoutDetails = approvedStalls.filter((r) => !parseStallNeeds(r.comments)).length;

  const stallTotals = useMemo(
    () => summariseStalls(allRegistrations.filter((r) => !eventFilter || r.event_id === eventFilter)),
    [allRegistrations, eventFilter]
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
      const message = rejectionMessage(r, eventName, festivalName);
      setConfirmation({ mobile: r.mobile, message });
      setConfirmDraft(message);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not reject.");
    } finally {
      setBusyId(null);
    }
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
            {/* A real link, not window.open() — an installed/PWA session can
                get stuck navigating in place if a script-triggered popup is
                blocked. A plain <a target="_blank"> is what browsers and
                app-shells reliably hand off to WhatsApp or the system
                browser, leaving this page untouched either way. */}
            <a
              href={`https://wa.me/91${confirmation.mobile}?text=${encodeURIComponent(confirmDraft)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setConfirmation(null)}
              className="flex-1 rounded-lg bg-maroon py-2 text-center text-xs font-semibold text-white"
            >
              Send via WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
            >
              Skip
            </button>
          </div>
          <p className="text-xs text-muted">
            The approval/rejection is already saved — sending this is optional. If they&apos;re not on WhatsApp, just
            skip; they&apos;ll see their status in My Stuff either way.
          </p>
        </section>
      )}

      {eventChips.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Event</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => chooseEvent("")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                !eventFilter ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
              }`}
            >
              All events{registrations.length > 0 ? ` (${registrations.length} to review)` : ""}
            </button>
            {eventChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => chooseEvent(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  eventFilter === c.id ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
                }`}
              >
                {c.name}
                {c.pending > 0 ? ` (${c.pending} to review)` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {stallEventIds.size > 0 && (
        <Link
          href={`/volunteer/events/stalls${eventFilter && stallEventIds.has(eventFilter) ? `?event=${encodeURIComponent(eventFilter)}` : ""}`}
          className="block rounded-xl border border-border bg-card py-3 text-center text-sm font-semibold text-maroon"
        >
          📄 Stall list (PDF) · every stall on one sheet
        </Link>
      )}

      {pendingGroups.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-card">
          <p className="px-4 py-3 text-sm text-muted">No nominations awaiting review.</p>
        </div>
      )}
      {pendingGroups.map((group) => (
      <section key={group.id} className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
          {group.name} <span className="font-normal normal-case">· {group.list.length} awaiting review</span>
        </h2>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {group.list.map((r) => (
          <div key={r.registration_id} className="px-4 py-3 space-y-2">
            <div>
              <p className="font-semibold text-sm">{r.participant_name}</p>
              <p className="text-xs text-muted">
                {r.sub_category ?? ""}
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
              {parseStallNeeds(r.comments) || stallEventIds.has(r.event_id) ? (
                <>
                  <StallDetails registration={r} isStall={stallEventIds.has(r.event_id)} />
                  {canReview && stallEventIds.has(r.event_id) && (
                    <StallPaymentControl registration={r} idToken={idToken as string} onSaved={() => setRefreshKey((k) => k + 1)} />
                  )}
                </>
              ) : (
                r.comments && <p className="text-xs text-muted italic">“{r.comments}”</p>
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
      </section>
      ))}

      {approvedStalls.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
            Approved stalls{eventFilter ? ` · ${eventNameById.get(eventFilter) ?? ""}` : ""}{" "}
            <span className="font-normal normal-case">· {approvedStalls.length}</span>
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {approvedStalls.map((r) => (
              <div key={r.registration_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{r.participant_name}</p>
                    <p className="text-xs text-muted">
                      {!eventFilter ? `${eventNameById.get(r.event_id) ?? r.event_id} · ` : ""}
                      Block {r.block}, Flat {r.flat_number} · {r.mobile}
                      {r.participant_age ? ` · Age ${r.participant_age}` : ""}
                    </p>
                  </div>
                  <StatusBadge label="Confirmed" tone="success" />
                </div>
                <StallDetails registration={r} isStall />
                {canReview && (
                  <StallPaymentControl registration={r} idToken={idToken as string} onSaved={() => setRefreshKey((k) => k + 1)} />
                )}
              </div>
            ))}
          </div>
          {approvedWithoutDetails > 0 && (
            <p className="text-xs text-muted">
              {approvedWithoutDetails} of these {approvedWithoutDetails === 1 ? "has" : "have"} no stall details saved (tables,
              chairs, power, payment), so {approvedWithoutDetails === 1 ? "it isn't" : "they aren't"} in the totals below. Ask{" "}
              {approvedWithoutDetails === 1 ? "that parent" : "those parents"} to send them again.
            </p>
          )}
        </section>
      )}

      {stallTotals.stalls > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
            Stall set-up needs{eventFilter ? ` · ${eventNameById.get(eventFilter) ?? ""}` : ""}
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { value: stallTotals.stalls, label: "stalls" },
              { value: stallTotals.kids, label: "kids" },
              { value: stallTotals.tables, label: "tables" },
              { value: stallTotals.chairs, label: "chairs" },
              { value: stallTotals.power, label: "need power" },
              ...(stallTotals.feeDue > 0
                ? [{ value: `₹${stallTotals.feeVerified} / ₹${stallTotals.feeDue}`, label: "table fees verified / due" }]
                : []),
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
                <p className="text-lg font-bold leading-tight text-maroon">{t.value}</p>
                <p className="text-[11px] leading-tight text-muted">{t.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Counts every stall sign-up that hasn&apos;t been rejected (pending and confirmed).</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Participant Report</h2>
            <p className="text-xs text-muted">
              {sortedReport.length} total nominations{" "}
              {eventFilter ? `for ${eventNameById.get(eventFilter) ?? "this event"}` : "across every event"}
            </p>
          </div>
          <button
            type="button"
            onClick={downloadReport}
            disabled={sortedReport.length === 0}
            className="shrink-0 rounded-lg bg-saffron px-3 py-2 text-xs font-semibold text-on-saffron disabled:opacity-60"
          >
            Download CSV
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {sortedReport.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm text-muted">No one has registered for an event yet.</p>
          )}
          {sortedReport.map((r) => {
            const eventName = eventNameById.get(r.event_id) ?? r.event_id;
            const followUpMessage = `Hi ${r.participant_name}, this is regarding your nomination for "${eventName}"${
              r.sub_category ? ` (${r.sub_category})` : ""
            } — `;
            return (
              <div key={r.registration_id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">{r.participant_name}</p>
                  <StatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "neutral"} />
                </div>
                <p className="text-xs text-muted">
                  {eventName}
                  {r.sub_category ? ` · ${r.sub_category}` : ""}
                </p>
                <p className="text-xs text-muted">
                  Block {r.block}, Flat {r.flat_number} · {r.mobile}
                  {r.participant_age ? ` · Age ${r.participant_age}` : ""}
                </p>
                <div className="flex items-center gap-3">
                  {/* Only Cultural nominations can have a song at all — for
                      everything else this row would just be noise. */}
                  {r.sub_category &&
                    (r.song_url ? (
                      <a
                        href={r.song_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-maroon underline"
                      >
                        🎵 Play song
                      </a>
                    ) : (
                      <p className="text-xs text-muted">No song uploaded</p>
                    ))}
                  <a
                    href={`https://wa.me/91${r.mobile}?text=${encodeURIComponent(followUpMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-maroon underline"
                  >
                    💬 WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
