"use client";

import { useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { fileToBase64 } from "@/lib/file";
import { useAsync } from "@/lib/useAsync";
import LoadingIndicator from "@/components/LoadingIndicator";

const COUNTERS = [1, 2, 3, 4];
const ALL_COUNTERS = 0;

/** Archive of the physical counter sheets — printed, ticked by hand during
 *  the dinner, then photographed or scanned afterwards as a permanent
 *  record. Separate from the live printable sheet above: that shows what
 *  the counter should look like; this is what a counter actually recorded.
 *  Not tied to a live counter map, since it's read from the paper itself. */
export default function ScannedSheets({ idToken }: { idToken: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [counter, setCounter] = useState<number>(ALL_COUNTERS);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: scans, loading } = useAsync(() => api.volunteer.listCounterSheetScans(idToken), [idToken, refreshKey]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await api.volunteer.uploadCounterSheetScan(idToken, {
        counter,
        image: await fileToBase64(file),
        mimeType: file.type || "image/jpeg",
        notes: notes.trim() || undefined,
      });
      setNotes("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not upload the scan. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Scanned Sheets</h2>
        <p className="text-xs text-muted">
          After the dinner, photograph or scan each counter&apos;s ticked sheet and add it here &mdash; the permanent
          record of what actually happened, separate from the printed sheet above.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <button
          type="button"
          onClick={() => setCounter(ALL_COUNTERS)}
          className={`w-full rounded-lg border py-2 text-sm font-semibold ${
            counter === ALL_COUNTERS ? "border-maroon bg-maroon/10 text-maroon" : "border-border"
          }`}
        >
          All Counters (one combined file)
        </button>
        <div className="grid grid-cols-4 gap-2">
          {COUNTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCounter(c)}
              className={`rounded-lg border py-2 text-sm font-semibold ${
                counter === c ? "border-maroon bg-maroon/10 text-maroon" : "border-border"
              }`}
            >
              Counter {c}
            </button>
          ))}
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) &mdash; e.g. page 2 of 2"
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {uploading
            ? "Uploading…"
            : `Upload scan for ${counter === ALL_COUNTERS ? "All Counters" : `Counter ${counter}`}`}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {loading && <LoadingIndicator />}
      {!loading && (scans ?? []).length === 0 && <p className="text-sm text-muted">No scans uploaded yet.</p>}
      {!loading && (scans ?? []).length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {(scans ?? []).map((s) => (
            <div key={s.scan_id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{s.counter === 0 ? "All Counters" : `Counter ${s.counter}`}</p>
                {s.notes && <p className="text-xs text-muted">{s.notes}</p>}
                <p className="text-xs text-muted">
                  {s.uploaded_by} &middot;{" "}
                  {new Date(s.uploaded_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Kolkata",
                  })}
                </p>
              </div>
              <a
                href={s.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold text-maroon underline"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
