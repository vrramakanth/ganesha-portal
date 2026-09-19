"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { buildHouseholds, parseMap } from "@/lib/dinnerHouseholds";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

const COUNTERS = [1, 2, 3, 4];

/** Plates issued at each counter against the members registered. Total
 *  plates issued across Counters 1-4 is the total dinner count. */
export default function PlateTallyPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const hasDinner = volunteer?.permissions.includes("Dinner") ?? false;
  const [refreshKey, setRefreshKey] = useState(0);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, loading, error: loadError } = useAsync(
    () =>
      hasDinner
        ? Promise.all([
            api.volunteer.getCommunityDinnerTally(idToken as string),
            api.festival.get(),
            api.volunteer.communityDinnerList(idToken as string),
          ])
        : Promise.resolve(null),
    [idToken, hasDinner, refreshKey]
  );

  const savedCounters = data?.[0].counters ?? {};
  const value = (c: number) => edits[c] ?? (savedCounters[c] !== undefined ? String(savedCounters[c]) : "");
  const issued = COUNTERS.reduce((sum, c) => sum + (Number(value(c)) || 0), 0);

  const map = parseMap(data?.[1].community_dinner_counter_map);
  const households = data ? buildHouseholds(data[2], map) : [];
  const expected = households.reduce((sum, h) => sum + h.members, 0);
  const difference = issued - expected;

  async function handleSave() {
    setError(null);
    setSaved(false);
    const counters: Record<number, number> = {};
    for (const c of COUNTERS) {
      const raw = value(c).trim();
      if (raw === "" || !/^\d+$/.test(raw)) {
        setError(`Enter plates issued for Counter ${c} (0 if none yet).`);
        return;
      }
      counters[c] = Number(raw);
    }
    setSaving(true);
    try {
      await api.volunteer.saveCommunityDinnerTally(idToken as string, counters);
      setEdits({});
      setSaved(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the tally.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Plate Tally"
        subtitle="Plates issued at each counter, against members registered"
        backHref="/volunteer/community-dinner"
        backLabel="← Community Dinner"
      />

      {!hasDinner && <p className="text-sm text-muted">You don&apos;t have access to Community Dinner.</p>}
      {loading && <LoadingIndicator />}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {data && (
        <>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {COUNTERS.map((c) => (
              <div key={c} className="px-4 py-3 flex items-center justify-between gap-3">
                <label htmlFor={`counter-${c}`} className="text-sm font-semibold">
                  Counter {c}
                </label>
                <input
                  id={`counter-${c}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={value(c)}
                  onChange={(e) => {
                    setEdits((prev) => ({ ...prev, [c]: e.target.value }));
                    setSaved(false);
                  }}
                  placeholder="Plates issued"
                  className="w-32 rounded-lg border border-border bg-card px-3 py-2 text-right text-sm"
                />
              </div>
            ))}
            <div className="px-4 py-3 flex items-center justify-between bg-background">
              <p className="text-sm font-semibold">Total plates issued</p>
              <p className="font-semibold text-maroon">{issued}</p>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-muted">Members registered (expected)</p>
              <p className="font-semibold">{expected}</p>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-muted">Difference</p>
              <p className={`font-semibold ${difference === 0 ? "text-green-700" : "text-amber-600"}`}>
                {difference > 0 ? "+" : ""}
                {difference}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted">
            Difference is plates issued minus members registered. A negative number means some registered members
            haven&apos;t collected a plate; a positive number means more plates went out than registrations.
          </p>
          {data[0].updatedAt && (
            <p className="text-xs text-muted">
              Last saved by {data[0].updatedBy} at{" "}
              {new Date(data[0].updatedAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              })}
              .
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Saved.</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-maroon py-3 text-center text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save tally"}
          </button>
        </>
      )}
    </div>
  );
}
