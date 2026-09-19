"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import { maxDeviation, splitConsecutive } from "@/lib/counterSplit";

const COUNTERS = [1, 2, 3, 4];

function parseMap(raw: string | undefined): Record<string, number> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Assigns each block to one of the four plate-distribution counters.
 *  Neighbouring blocks share a counter (easy to remember), chosen so plate
 *  volume, not the number of blocks, is even. Households added late go to
 *  their own counter whatever their block, and are counted there. */
export default function DinnerCountersPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const hasDinner = volunteer?.permissions.includes("Dinner") ?? false;
  const [refreshKey, setRefreshKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);

  const { data, loading, error: loadError } = useAsync(
    () =>
      hasDinner
        ? Promise.all([
            api.festival.get(),
            api.blocks.list(),
            api.volunteer.communityDinnerList(idToken as string),
          ])
        : Promise.resolve(null),
    [idToken, hasDinner, refreshKey]
  );

  const savedMap = parseMap(data?.[0].community_dinner_counter_map);
  const assignment: Record<string, number> = { ...savedMap, ...edits };
  const blocks = [...(data?.[1] ?? [])].sort((a, b) => a.block_name.localeCompare(b.block_name));

  const stats: Record<string, { households: number; plates: number }> = {};
  const lateByCounter: Record<number, { households: number; plates: number }> = {};
  (data?.[2] ?? [])
    .filter((r) => r.status !== "REJECTED" && r.status !== "CANCELLED")
    .forEach((r) => {
      const plates = r.adults + r.children + r.guest_adults + r.guest_children;
      if (r.counter_override) {
        const l = (lateByCounter[r.counter_override] ??= { households: 0, plates: 0 });
        l.households += 1;
        l.plates += plates;
        return;
      }
      const s = (stats[r.block] ??= { households: 0, plates: 0 });
      s.households += 1;
      s.plates += plates;
    });

  const blockPlates = blocks.reduce((sum, b) => sum + (stats[b.block_name]?.plates ?? 0), 0);
  const latePlates = Object.values(lateByCounter).reduce((sum, l) => sum + l.plates, 0);
  const lateHouseholds = Object.values(lateByCounter).reduce((sum, l) => sum + l.households, 0);
  const totalPlates = blockPlates + latePlates;
  const perCounter = COUNTERS.map((c) => {
    const inCounter = blocks.filter((b) => assignment[b.block_name] === c);
    return {
      counter: c,
      blocks: inCounter.map((b) => b.block_name),
      households:
        inCounter.reduce((sum, b) => sum + (stats[b.block_name]?.households ?? 0), 0) +
        (lateByCounter[c]?.households ?? 0),
      plates:
        inCounter.reduce((sum, b) => sum + (stats[b.block_name]?.plates ?? 0), 0) + (lateByCounter[c]?.plates ?? 0),
      latePlates: lateByCounter[c]?.plates ?? 0,
      lateHouseholds: lateByCounter[c]?.households ?? 0,
    };
  });
  const averagePlates = totalPlates / COUNTERS.length;
  const overallDeviation = maxDeviation(perCounter.map((c) => c.plates));
  const unassigned = blocks.filter((b) => !assignment[b.block_name]);

  function suggest() {
    const weights = blocks.map((b) => stats[b.block_name]?.plates ?? 0);
    const preloads = COUNTERS.map((c) => lateByCounter[c]?.plates ?? 0);
    const assignmentList = splitConsecutive(weights, COUNTERS.length, preloads);
    const next: Record<string, number> = {};
    blocks.forEach((b, i) => (next[b.block_name] = assignmentList[i]));
    setEdits(next);
    setSaved(false);
    setSuggestionNote("Neighbouring blocks share a counter, chosen so plates are as even as possible.");
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.volunteer.saveCommunityDinnerCounters(idToken as string, assignment);
      setEdits({});
      setSaved(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save counter assignments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Plate Counters"
        subtitle="Each block goes to exactly one of Counters 1 to 4"
        backHref="/volunteer/community-dinner"
        backLabel="← Community Dinner"
      />

      {!hasDinner && <p className="text-sm text-muted">You don&apos;t have access to Community Dinner.</p>}
      {loading && <LoadingIndicator />}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {data && (
        <>
          <p className="text-sm text-muted">
            {totalPlates} plates across {COUNTERS.length} counters: about{" "}
            <span className="font-semibold text-maroon">{Math.round(averagePlates)}</span> each. Balanced by
            plates, not by number of blocks.
            {lateHouseholds > 0 &&
              ` ${lateHouseholds} household${lateHouseholds === 1 ? "" : "s"} added after registration closed all go to Counter ${Object.keys(lateByCounter)[0]}, whatever their block.`}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {perCounter.map((c) => (
              <div key={c.counter} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm font-semibold">Counter {c.counter}</p>
                <p className="text-xs text-muted">{c.blocks.length ? c.blocks.join(", ") : "No blocks yet"}</p>
                <p className="mt-1 text-xs text-muted">
                  {c.households} households · <span className="font-semibold text-maroon">{c.plates} plates</span>
                </p>
                {c.lateHouseholds > 0 && (
                  <p className="text-xs text-muted">
                    incl. {c.lateHouseholds} late ({c.latePlates} plates)
                  </p>
                )}
                {averagePlates > 0 && (
                  <p
                    className={`text-xs font-semibold ${
                      Math.abs(c.plates - averagePlates) / averagePlates <= 0.05
                        ? "text-green-700"
                        : Math.abs(c.plates - averagePlates) / averagePlates <= 0.1
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {c.plates >= averagePlates ? "+" : ""}
                    {Math.round(c.plates - averagePlates)} vs average
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={suggest}
            className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-maroon"
          >
            Suggest a balanced split
          </button>
          {suggestionNote && <p className="-mt-3 text-xs text-muted">{suggestionNote}</p>}
          {unassigned.length === 0 && totalPlates > 0 && overallDeviation > 0.1 && (
            <p className="text-sm text-amber-600">
              The busiest counter is {Math.round(overallDeviation * 100)}% off the average. Try &quot;Suggest a
              balanced split&quot;.
            </p>
          )}

          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {blocks.map((b) => {
              const s = stats[b.block_name];
              return (
                <div key={b.block_id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Block {b.block_name}</p>
                    <p className="text-xs text-muted">
                      {s ? `${s.households} households · ${s.plates} plates` : "No registrations"}
                    </p>
                  </div>
                  <select
                    value={assignment[b.block_name] ?? ""}
                    onChange={(e) => {
                      setEdits((prev) => ({ ...prev, [b.block_name]: Number(e.target.value) }));
                      setSaved(false);
                    }}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Pick counter
                    </option>
                    {COUNTERS.map((c) => (
                      <option key={c} value={c}>
                        Counter {c}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {unassigned.length > 0 && (
            <p className="text-sm text-red-600">
              Still to assign: {unassigned.map((b) => b.block_name).join(", ")}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Saved. Counters are now live for residents.</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || unassigned.length > 0 || Object.keys(edits).length === 0}
            className="w-full rounded-xl bg-maroon py-3 text-center text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save counter assignments"}
          </button>
        </>
      )}
    </div>
  );
}
