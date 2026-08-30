"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
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

  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: dashboard, loading, error } = useAsync(
    () => (selected ? api.volunteer.dinnerDashboard(idToken as string, selected) : Promise.resolve(null)),
    [idToken, selected]
  );

  const { data: needsReview } = useAsync(
    () => api.volunteer.dinnerPayments(idToken as string),
    [idToken, refreshKey]
  );

  async function handleApprove(entitlementId: string) {
    setActionError(null);
    setActioning(entitlementId);
    try {
      await api.volunteer.approveDinnerPayment(idToken as string, entitlementId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not approve payment.");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(entitlementId: string) {
    setActionError(null);
    setActioning(entitlementId);
    try {
      await api.volunteer.rejectDinnerPayment(idToken as string, entitlementId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject payment.");
    } finally {
      setActioning(null);
    }
  }

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

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {needsReview && needsReview.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Payments Needing Review</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {needsReview.map((e) => (
              <div key={e.entitlement_id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {e.block} · {e.flat_number}
                    </p>
                    <p className="text-xs text-muted">
                      {e.allocated_quantity} meals · {e.entitlement_id}
                    </p>
                    <p className="text-xs text-muted">{e.source.replace("ONLINE:MANUAL:", "Ref: ")}</p>
                    {e.payment_screenshot_url && (
                      <a
                        href={e.payment_screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-semibold text-maroon"
                      >
                        View Screenshot
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={actioning === e.entitlement_id}
                    onClick={() => handleApprove(e.entitlement_id)}
                    className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    disabled={actioning === e.entitlement_id}
                    onClick={() => handleReject(e.entitlement_id)}
                    className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
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
