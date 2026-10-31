"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";

/** "Is your flat taking part?" for a Flat Opt-in event (e.g. Trick or Treat):
 *  block, flat, whether the door is open, and how many kids will go out. The flats that said yes are listed
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
  const [welcoming, setWelcoming] = useState<boolean | null>(null);
  const [kids, setKids] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ participating: boolean; kids: number; label: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data } = useAsync(() => api.events.flatList(eventId), [eventId, refreshKey]);

  async function save() {
    if (welcoming === null) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.events.flatSet({
        eventId,
        block,
        flatNumber: flat,
        participating: welcoming,
        kids: kidsSupported ? Number(kids) || 0 : 0,
      });
      setSaved({ participating: result.participating, kids: result.kids ?? 0, label: `${result.block}-${result.flatNumber}` });
      saveProfile({ ...profile, block, flatNumber: flat });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // The kids question only appears once the backend reports a kids total, so
  // a backend that hasn't been updated yet shows the plain yes/no form
  // instead of a box whose answer would be thrown away.
  const kidsSupported = data?.kidsTotal !== undefined;
  const byBlock = new Map<string, string[]>();
  (data?.participating ?? []).forEach((f) => byBlock.set(f.block, [...(byBlock.get(f.block) ?? []), f.flat_number]));
  const ready = /^[A-Z]$/.test(block) && /^\d{3}$/.test(flat) && welcoming !== null;

  return (
    <div className="space-y-4">
      {open && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {saved ? (
            <p className="text-sm text-green-700">
              Thank you! Flat {saved.label}: {saved.participating ? "door open for trick or treat 🎃" : "door closed this time"}
              {saved.kids > 0 ? `, ${saved.kids} ${saved.kids === 1 ? "kid" : "kids"} joining` : ""}.{" "}
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

              <div className="space-y-2">
                <p className="text-sm font-semibold">Will your flat welcome trick-or-treaters?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWelcoming(true)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-semibold ${
                      welcoming === true ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
                    }`}
                  >
                    Yes, we&apos;re in
                  </button>
                  <button
                    type="button"
                    onClick={() => setWelcoming(false)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-semibold ${
                      welcoming === false ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
                    }`}
                  >
                    Not this time
                  </button>
                </div>
              </div>

              {kidsSupported && (
              <div className="space-y-1">
                <label className="text-sm font-semibold">Kids from your flat going trick-or-treating</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  value={kids}
                  onChange={(e) => setKids(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="0"
                  className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
                />
                <p className="text-xs text-muted">Leave empty if none.</p>
              </div>
              )}

              <button
                type="button"
                disabled={!ready || submitting}
                onClick={save}
                className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className={`grid gap-2 ${kidsSupported ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-center">
            <p className="text-lg font-bold leading-tight text-maroon">{data ? data.participating.length : "–"}</p>
            <p className="text-[11px] leading-tight text-muted">flats welcoming</p>
          </div>
          {kidsSupported && (
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-center">
            <p className="text-lg font-bold leading-tight text-maroon">{data?.kidsTotal ?? "–"}</p>
            <p className="text-[11px] leading-tight text-muted">
              kids joining{data?.kidsFlats ? ` from ${data.kidsFlats} ${data.kidsFlats === 1 ? "flat" : "flats"}` : ""}
            </p>
          </div>
          )}
        </div>
        {data && data.participating.length > 0 && (
          <Link
            href={`/events/${eventId}/report`}
            className="block rounded-xl border border-border bg-card py-3 text-center text-sm font-semibold text-maroon"
          >
            🎃 Download the houses list (PDF)
          </Link>
        )}
        <p className="pt-1 text-xs font-semibold tracking-wide uppercase text-muted">Flats welcoming</p>
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
