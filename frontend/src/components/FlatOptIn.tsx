"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";

/** "Is your flat taking part?" for a Flat Opt-in event (e.g. Trick or Treat):
 *  block, flat and a yes/no, nothing else. The flats that said yes are listed
 *  underneath, so children know whose doors to knock on. Answering again for
 *  the same flat just changes the answer. */
export default function FlatOptIn({ eventId, open }: { eventId: string; open: boolean }) {
  const { profile, saveProfile, loaded } = useResidentProfile();
  // null until the visitor types, so their saved block/flat fills in once it
  // has loaded without needing an effect to copy it across.
  const [typedBlock, setBlock] = useState<string | null>(null);
  const [typedFlat, setFlat] = useState<string | null>(null);
  const block = typedBlock ?? (loaded ? profile.block : "");
  const flat = typedFlat ?? (loaded ? profile.flatNumber : "");
  const [submitting, setSubmitting] = useState<"YES" | "NO" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ participating: boolean; label: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data } = useAsync(() => api.events.flatList(eventId), [eventId, refreshKey]);

  async function answer(participating: boolean) {
    setError(null);
    setSubmitting(participating ? "YES" : "NO");
    try {
      const result = await api.events.flatSet({ eventId, block, flatNumber: flat, participating });
      setSaved({ participating: result.participating, label: `${result.block}-${result.flatNumber}` });
      saveProfile({ ...profile, block, flatNumber: flat });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save your answer. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const byBlock = new Map<string, string[]>();
  (data?.participating ?? []).forEach((f) => byBlock.set(f.block, [...(byBlock.get(f.block) ?? []), f.flat_number]));
  const ready = /^[A-Z]$/.test(block) && /^\d{3}$/.test(flat);

  return (
    <div className="space-y-4">
      {open && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Is your flat taking part?</p>
          {saved ? (
            <p className="text-sm text-green-700">
              {saved.participating
                ? `Thank you! Flat ${saved.label} is on the list. 🎃`
                : `Noted: flat ${saved.label} is not taking part.`}{" "}
              <button type="button" onClick={() => setSaved(null)} className="font-semibold text-maroon underline">
                Change answer
              </button>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Block</label>
                  <BlockSelect value={block} onChange={setBlock} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Flat (3 digits)</label>
                  <FlatInput value={flat} onChange={setFlat} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!ready || submitting !== null}
                  onClick={() => answer(true)}
                  className="flex-1 rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting === "YES" ? "…" : "Yes, we're in"}
                </button>
                <button
                  type="button"
                  disabled={!ready || submitting !== null}
                  onClick={() => answer(false)}
                  className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground disabled:opacity-60"
                >
                  {submitting === "NO" ? "…" : "Not this time"}
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase text-muted">
          Flats taking part{data ? ` (${data.participating.length})` : ""}
        </p>
        {data && data.participating.length === 0 && <p className="text-sm text-muted">No flats yet.</p>}
        {[...byBlock.entries()].map(([b, flats]) => (
          <p key={b} className="text-sm">
            <span className="font-semibold">Block {b}:</span> {flats.join(", ")}
          </p>
        ))}
      </div>
    </div>
  );
}
