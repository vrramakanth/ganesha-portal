"use client";

import { useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { VOLUNTEER_AREAS, parseVolunteerAvailability, type VolunteerSignup } from "@/lib/volunteerAreas";
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
  return picks.map((p) => `${p.dates.join(", ")} — ${p.session}`).join("; ");
}

function slotSort(a: Slot, b: Slot) {
  const dayA = parseInt(a.date, 10) || 0;
  const dayB = parseInt(b.date, 10) || 0;
  if (dayA !== dayB) return dayA - dayB;
  return (SESSION_ORDER[a.session] ?? 2) - (SESSION_ORDER[b.session] ?? 2);
}

/** Groups an area's ACTIVE sign-ups into one row per date+session, so
 *  admins can see who's confirmed to turn up when at a glance. Anyone
 *  whose pick didn't parse (older free-text availability from before
 *  dates/sessions existed) lands in a trailing "Not specified" row. */
function buildActiveSlots(volunteers: VolunteerRegistration[], area: string): Slot[] {
  const slotMap = new Map<string, Slot>();
  const unspecified: string[] = [];

  volunteers
    .filter((v) => v.status === "ACTIVE" && volunteerAreaList(v).includes(area))
    .forEach((v) => {
      const picks = picksForArea(v, area);
      if (picks.length === 0) {
        unspecified.push(v.name);
        return;
      }
      picks.forEach((pick) =>
        pick.dates.forEach((date) => {
          const key = `${date}|${pick.session}`;
          if (!slotMap.has(key)) slotMap.set(key, { date, session: pick.session, names: [] });
          slotMap.get(key)!.names.push(v.name);
        })
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
  return `Hi ${v.name}, thanks so much for signing up to help with "${area}" for Ganesha Chathurthi (${when})! We already have enough hands for that slot — would a different date or session work for you? Let us know and we'll sort it out. 🙏`;
}

export default function VolunteersPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askingId, setAskingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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
          (v) => v.status !== "ACTIVE" && volunteerAreaList(v).includes(a.label)
        ),
      })),
    [volunteers]
  );

  const bothAreas = useMemo(
    () => volunteers.filter((v) => AREA_LABELS.every((label) => volunteerAreaList(v).includes(label))),
    [volunteers]
  );

  const otherSignups = useMemo(
    () => volunteers.filter((v) => volunteerAreaList(v).every((a) => !AREA_LABELS.includes(a))),
    [volunteers]
  );

  async function activate(volunteerId: string) {
    setError(null);
    setBusyId(volunteerId);
    try {
      await api.volunteer.activateVolunteer(idToken as string, volunteerId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not activate volunteer.");
    } finally {
      setBusyId(null);
    }
  }

  function startAsk(v: VolunteerRegistration, area: string) {
    setAskingId(v.volunteer_id);
    setDraft(rescheduleMessage(v, area, picksForArea(v, area)));
  }

  function sendAsk(v: VolunteerRegistration) {
    window.open(`https://wa.me/91${v.mobile}?text=${encodeURIComponent(draft)}`, "_blank");
    setAskingId(null);
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Volunteers" backHref="/volunteer" backLabel="← Dashboard" />

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
                      const clash = picks.some((p) =>
                        p.dates.some((d) => activeCountFor(active, d, p.session) > 0)
                      );
                      return (
                        <div key={v.volunteer_id} className="px-4 py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">
                                {v.name} <span className="font-normal text-muted">({v.block}-{v.flat_number})</span>
                              </p>
                              <p className="text-xs text-muted">{formatPicks(picks)}</p>
                              {clash && (
                                <p className="text-xs font-semibold text-saffron-dark mt-0.5">
                                  ⚠ Overlaps with someone already confirmed
                                </p>
                              )}
                            </div>
                          </div>

                          {askingId === v.volunteer_id ? (
                            <div className="space-y-2">
                              <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={4}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => sendAsk(v)}
                                  className="flex-1 rounded-lg bg-saffron py-2 text-center text-xs font-semibold text-white"
                                >
                                  Send via WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAskingId(null)}
                                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
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
                                onClick={() => activate(v.volunteer_id)}
                                className="flex-1 rounded-lg bg-maroon py-2 text-center text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => startAsk(v, area)}
                                className="flex-1 rounded-lg border border-border py-2 text-center text-xs font-semibold text-maroon"
                              >
                                Ask for different date
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
