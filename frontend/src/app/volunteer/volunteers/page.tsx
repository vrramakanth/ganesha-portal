"use client";

import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { VOLUNTEER_AREAS, parseVolunteerAvailability, isAreaApproved, type VolunteerSignup } from "@/lib/volunteerAreas";
import type { VolunteerRegistration } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";

const SESSION_ORDER: Record<string, number> = { Morning: 0, Evening: 1 };
const AREA_LABELS = VOLUNTEER_AREAS.map((a) => a.label);

type Slot = { date: string; session: string; names: string[] };

function volunteerAreaList(v: VolunteerRegistration): string[] {
  return String(v.areas).split(",").map((a) => a.trim()).filter(Boolean);
}

function picksForArea(v: VolunteerRegistration, area: string): VolunteerSignup[] {
  return parseVolunteerAvailability(v.availability).filter((s) => s.area === area);
}

function formatPicks(picks: VolunteerSignup[]): string {
  if (picks.length === 0) return "date/session not specified";
  return picks.map((p) => `${p.dates.join(", ")} — ${p.sessions.join(", ")}`).join("; ");
}

/** Flattens picks into one entry per exact date+session, so each can be
 *  checked against "Signed Up" individually — a request spanning two
 *  dates might clash on only one of them. */
function pickSlots(picks: VolunteerSignup[]): { date: string; session: string }[] {
  const slots: { date: string; session: string }[] = [];
  picks.forEach((p) => p.dates.forEach((date) => p.sessions.forEach((session) => slots.push({ date, session }))));
  return slots;
}

function slotSort(a: Slot, b: Slot) {
  const dayA = parseInt(a.date, 10) || 0;
  const dayB = parseInt(b.date, 10) || 0;
  if (dayA !== dayB) return dayA - dayB;
  return (SESSION_ORDER[a.session] ?? 2) - (SESSION_ORDER[b.session] ?? 2);
}

/** Groups an area's approved sign-ups into one row per date+session, so
 *  admins can see who's confirmed to turn up when at a glance. Anyone
 *  whose pick didn't parse (older free-text availability from before
 *  dates/sessions existed) lands in a trailing "Not specified" row. */
function buildActiveSlots(volunteers: VolunteerRegistration[], area: string): Slot[] {
  const slotMap = new Map<string, Slot>();
  const unspecified: string[] = [];

  volunteers
    .filter((v) => isAreaApproved(v, area))
    .forEach((v) => {
      const picks = picksForArea(v, area);
      if (picks.length === 0) {
        unspecified.push(v.name);
        return;
      }
      picks.forEach((pick) =>
        pick.dates.forEach((date) =>
          pick.sessions.forEach((session) => {
            const key = `${date}|${session}`;
            if (!slotMap.has(key)) slotMap.set(key, { date, session, names: [] });
            slotMap.get(key)!.names.push(v.name);
          })
        )
      );
    });

  const slots = Array.from(slotMap.values()).sort(slotSort);
  if (unspecified.length > 0) slots.push({ date: "Not specified", session: "—", names: unspecified });
  return slots;
}

/** How many ACTIVE volunteers are already confirmed for this exact
 *  date+session in this area — shown next to a pending request so an
 *  admin can spot a clash (too many people wanting the same slot)
 *  without cross-referencing the "Signed Up" table above. */
function activeCountFor(activeSlots: Slot[], date: string, session: string): number {
  return activeSlots.find((s) => s.date === date && s.session === session)?.names.length ?? 0;
}

function rescheduleMessage(v: VolunteerRegistration, area: string, picks: VolunteerSignup[]): string {
  const when = picks.length > 0 ? formatPicks(picks) : "your preferred date";
  return `Hi ${v.name}, thanks so much for signing up to help with "${area}" for Ganesha Chathurthi (${when})! We already have enough hands for that slot. If a different date or session works for you, please sign up again on the app with your new preference — otherwise no action needed. 🙏`;
}

export default function VolunteersPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ volunteerId: string; area: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [declining, setDeclining] = useState(false);

  const { data, loading, error: loadError } = useAsync(
    () => api.volunteer.volunteersList(idToken as string),
    [idToken, refreshKey]
  );

  const volunteers = useMemo(() => data?.volunteers ?? [], [data]);

  const areaSections = useMemo(
    () =>
      VOLUNTEER_AREAS.map((a) => ({
        area: a.label,
        active: buildActiveSlots(volunteers, a.label),
        pending: volunteers.filter(
          (v) => volunteerAreaList(v).includes(a.label) && !isAreaApproved(v, a.label)
        ),
      })),
    [volunteers]
  );

  const bothAreas = useMemo(
    () => volunteers.filter((v) => AREA_LABELS.every((label) => volunteerAreaList(v).includes(label))),
    [volunteers]
  );

  const otherSignups = useMemo(
    () =>
      volunteers.filter((v) => {
        const areas = volunteerAreaList(v);
        return areas.length > 0 && areas.every((a) => !AREA_LABELS.includes(a));
      }),
    [volunteers]
  );

  async function activate(volunteerId: string) {
    setError(null);
    setBusyId(volunteerId);
    try {
      await api.volunteer.activateVolunteer(idToken as string, volunteerId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not activate.");
    } finally {
      setBusyId(null);
    }
  }

  async function approveArea(volunteerId: string, area: string) {
    setError(null);
    setBusyId(volunteerId);
    try {
      await api.volunteer.approveVolunteerArea(idToken as string, volunteerId, area);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not approve.");
    } finally {
      setBusyId(null);
    }
  }

  function startAsk(v: VolunteerRegistration, area: string) {
    setAsking({ volunteerId: v.volunteer_id, area });
    setDraft(rescheduleMessage(v, area, picksForArea(v, area)));
  }

  /** Declining removes this area from their request first (so it stops
   *  showing up as a pending entry — no stale duplicates once the admin
   *  has already reached out), then opens WhatsApp with the reschedule
   *  message. If the WhatsApp step fails to open for some reason the
   *  decline has still gone through; nothing here is reversible. */
  async function sendAsk(v: VolunteerRegistration, area: string) {
    setError(null);
    setDeclining(true);
    try {
      await api.volunteer.declineVolunteerArea(idToken as string, v.volunteer_id, area);
      window.open(`https://wa.me/91${v.mobile}?text=${encodeURIComponent(draft)}`, "_blank");
      setAsking(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not decline.");
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Seva" backHref="/volunteer" backLabel="← Dashboard" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <StatTile value={String(data.registered)} label="Registered" />

          {bothAreas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
                Applying For Both Areas
              </h2>
              <div className="rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 flex flex-wrap gap-2">
                {bothAreas.map((v) => (
                  <span key={v.volunteer_id} className="text-sm font-semibold text-saffron-dark">
                    {v.name} ({v.block}-{v.flat_number})
                  </span>
                ))}
              </div>
            </section>
          )}

          {areaSections.map(({ area, active, pending }) => {
            const stats = data.byArea.find((a) => a.area === area);
            return (
              <section key={area} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">{area}</h2>
                  {stats && (
                    <p className="text-xs font-semibold text-maroon">
                      {stats.filled} / {stats.required} confirmed
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Signed Up</p>
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {active.length === 0 && <p className="px-4 py-3 text-sm text-muted">No one confirmed yet.</p>}
                    {active.map((slot) => (
                      <div key={`${slot.date}|${slot.session}`} className="px-4 py-3 flex items-start gap-3 text-sm">
                        <div className="w-24 shrink-0">
                          <p className="font-semibold">{slot.date}</p>
                          <p className="text-xs text-muted">{slot.session}</p>
                        </div>
                        <p className="text-foreground">{slot.names.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Requests</p>
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {pending.length === 0 && <p className="px-4 py-3 text-sm text-muted">No pending requests.</p>}
                    {pending.map((v) => {
                      const picks = picksForArea(v, area);
                      const slots = pickSlots(picks);
                      const isAsking = asking?.volunteerId === v.volunteer_id && asking?.area === area;
                      return (
                        <div key={v.volunteer_id} className="px-4 py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">
                                {v.name} <span className="font-normal text-muted">({v.block}-{v.flat_number})</span>
                              </p>
                              {slots.length === 0 ? (
                                <p className="text-xs text-muted">date/session not specified</p>
                              ) : (
                                slots.map((slot, i) => {
                                  const count = activeCountFor(active, slot.date, slot.session);
                                  return (
                                    <p
                                      key={i}
                                      className={`text-xs ${count > 0 ? "font-semibold text-saffron-dark" : "text-muted"}`}
                                    >
                                      {slot.date} — {slot.session}
                                      {count > 0 &&
                                        ` · ${count} volunteer${count === 1 ? "" : "s"} already signed up`}
                                    </p>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {isAsking ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-saffron-dark">
                                This will decline the request and remove it from the list.
                              </p>
                              <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={4}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={declining}
                                  onClick={() => sendAsk(v, area)}
                                  className="flex-1 rounded-lg bg-saffron py-2 text-center text-xs font-semibold text-white disabled:opacity-60"
                                >
                                  {declining ? "Declining…" : "Decline & Send via WhatsApp"}
                                </button>
                                <button
                                  type="button"
                                  disabled={declining}
                                  onClick={() => setAsking(null)}
                                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busyId === v.volunteer_id}
                                onClick={() => approveArea(v.volunteer_id, area)}
                                className="flex-1 rounded-lg bg-maroon py-2 text-center text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => startAsk(v, area)}
                                className="flex-1 rounded-lg border border-border py-2 text-center text-xs font-semibold text-maroon"
                              >
                                Decline & Ask to Reconsider
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}

          {otherSignups.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
                Other Sign-ups
              </h2>
              <p className="text-xs text-muted">
                Registered under an area that&apos;s no longer open — check in with them directly.
              </p>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {otherSignups.map((v) => (
                  <div key={v.volunteer_id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{v.name}</p>
                      <p className="text-xs text-muted">
                        {v.block} · {v.flat_number} · {v.areas}
                      </p>
                    </div>
                    {v.status !== "ACTIVE" && (
                      <button
                        disabled={busyId === v.volunteer_id}
                        onClick={() => activate(v.volunteer_id)}
                        className="rounded-lg bg-maroon px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
