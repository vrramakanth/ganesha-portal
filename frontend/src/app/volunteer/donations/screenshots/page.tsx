"use client";

import { useMemo, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency } from "@/lib/date";
import { fileToBase64 } from "@/lib/file";
import type { Transaction } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";

const STATUS_TONE: Record<string, BadgeTone> = {
  SUCCESS: "success",
  VERIFIED_SUCCESS: "success",
  MANUAL_REVIEW: "warning",
};

/** Statuses where a screenshot is actually expected — excludes
 *  PAYMENT_PENDING/INITIATED (never claimed to pay) and CANCELLED/
 *  FAILED (nothing to reconcile). */
const RELEVANT_STATUSES = ["MANUAL_REVIEW", "SUCCESS", "VERIFIED_SUCCESS"];

function sortByFlat(a: Transaction, b: Transaction) {
  if (a.block !== b.block) return a.block.localeCompare(b.block);
  return a.flat_number.localeCompare(b.flat_number);
}

export default function AttachScreenshotsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: transactions, loading, error: loadError } = useAsync(
    () => api.volunteer.transactions(idToken as string),
    [idToken, refreshKey]
  );

  const missing = useMemo(
    () =>
      (transactions ?? [])
        .filter((t) => !t.payment_screenshot_url && RELEVANT_STATUSES.includes(t.status))
        .sort(sortByFlat),
    [transactions]
  );

  async function handleFile(t: Transaction, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploadingId(t.transaction_id);
    try {
      const base64 = await fileToBase64(file);
      await api.volunteer.attachPaymentScreenshot(
        idToken as string,
        t.transaction_id,
        base64,
        file.type || "image/jpeg"
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not upload screenshot.");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Attach Missing Screenshots"
        subtitle="For payments moved to review without one uploaded through the app"
        backHref="/volunteer/donations"
        backLabel="← Donations"
      />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {transactions && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {missing.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">Nothing missing a screenshot.</p>
          )}
          {missing.map((t) => (
            <div key={t.transaction_id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">
                    {t.block}-{t.flat_number} · {t.resident_name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatCurrency(Number(t.amount))} · {t.transaction_id}
                  </p>
                </div>
                <StatusBadge label={t.status.replace(/_/g, " ")} tone={STATUS_TONE[t.status] ?? "neutral"} />
              </div>

              <input
                ref={(el) => {
                  fileInputRefs.current[t.transaction_id] = el;
                }}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(t, e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingId === t.transaction_id}
                onClick={() => fileInputRefs.current[t.transaction_id]?.click()}
                className="w-full rounded-lg border border-border py-2 text-center text-xs font-semibold text-maroon disabled:opacity-60"
              >
                {uploadingId === t.transaction_id ? "Uploading…" : "Upload Screenshot"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
