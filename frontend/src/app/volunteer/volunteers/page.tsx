"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import StatusBadge from "@/components/StatusBadge";

export default function VolunteersPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, error: loadError } = useAsync(
    () => api.volunteer.volunteersList(idToken as string),
    [idToken, refreshKey]
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

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Volunteers" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile value={String(data.registered)} label="Registered" />
            <StatTile value={String(data.required)} label="Required" />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">By Area</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {data.byArea.length === 0 && <p className="px-4 py-3 text-sm text-muted">No areas configured.</p>}
              {data.byArea.map((a) => {
                const short = a.filled < a.required;
                return (
                  <div key={a.area} className="px-4 py-3 flex items-center justify-between text-sm">
                    <p>{a.area}</p>
                    <p className={`font-semibold ${short ? "text-saffron-dark" : "text-maroon"}`}>
                      {a.filled} / {a.required}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Registered Volunteers</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {data.volunteers.length === 0 && <p className="px-4 py-3 text-sm text-muted">No volunteers yet.</p>}
              {data.volunteers.map((v) => (
                <div key={v.volunteer_id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{v.name}</p>
                    <p className="text-xs text-muted">
                      {v.block} · {v.flat_number} · {v.areas}
                    </p>
                  </div>
                  {v.status === "ACTIVE" ? (
                    <StatusBadge label="ACTIVE" tone="success" />
                  ) : (
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
        </>
      )}
    </div>
  );
}
