"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";

const STATUS_TONE: Record<string, BadgeTone> = {
  SUCCESS: "success",
  VERIFIED_SUCCESS: "success",
  MANUAL_REVIEW: "warning",
  PAYMENT_PENDING: "info",
  INITIATED: "info",
  FAILED: "danger",
  EXPIRED: "danger",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

export default function VolunteerDonationsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: transactions, loading, error } = useAsync(
    () => api.volunteer.transactions(idToken as string),
    [idToken, refreshKey]
  );

  const rows = transactions ?? [];
  const needsReview = rows.filter((t) => t.status === "MANUAL_REVIEW");
  const totalCollected = rows
    .filter((t) => t.status === "SUCCESS" || t.status === "VERIFIED_SUCCESS")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const byBlock: Record<string, number> = {};
  rows
    .filter((t) => t.status === "SUCCESS" || t.status === "VERIFIED_SUCCESS")
    .forEach((t) => {
      byBlock[t.block] = (byBlock[t.block] || 0) + Number(t.amount || 0);
    });

  async function handleVerify(transactionId: string) {
    setActionError(null);
    setActioning(transactionId);
    try {
      await api.volunteer.verifyPayment(idToken as string, transactionId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not verify payment.");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(transactionId: string) {
    setActionError(null);
    setActioning(transactionId);
    try {
      await api.volunteer.rejectPayment(idToken as string, transactionId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject payment.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Donations" subtitle="Collections and payment review" />

      <Link href="/volunteer/donations/screenshots" className="text-xs font-medium text-maroon underline -mt-4">
        Attach Missing Screenshots
      </Link>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {transactions && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile value={formatCurrency(totalCollected)} label="Total Collected" />
            <StatTile value={String(rows.length)} label="Transactions" />
            <StatTile value={String(needsReview.length)} label="Manual Review" />
            <StatTile
              value={String(rows.filter((t) => t.status === "PAYMENT_PENDING" || t.status === "FAILED").length)}
              label="Pending / Failed"
            />
          </div>

          {needsReview.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Needs Review</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {needsReview.map((t) => (
                  <div key={t.transaction_id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{t.resident_name}</p>
                        <p className="text-xs text-muted">
                          {t.block} · {t.flat_number} · {t.transaction_id}
                        </p>
                      </div>
                      <p className="font-semibold text-maroon shrink-0">{formatCurrency(Number(t.amount))}</p>
                    </div>
                    {t.payment_reference && (
                      <p className="text-xs text-muted">Ref: {t.payment_reference}</p>
                    )}
                    {t.payment_screenshot_url && (
                      <a
                        href={t.payment_screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-semibold text-maroon"
                      >
                        View Screenshot
                      </a>
                    )}
                    <div className="flex gap-2">
                      <button
                        disabled={actioning === t.transaction_id}
                        onClick={() => handleVerify(t.transaction_id)}
                        className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                      >
                        Verify
                      </button>
                      <button
                        disabled={actioning === t.transaction_id}
                        onClick={() => handleReject(t.transaction_id)}
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

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Recent Transactions</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {rows.length === 0 && <p className="px-4 py-3 text-sm text-muted">No transactions yet.</p>}
              {rows.map((t) => (
                <div key={t.transaction_id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{t.resident_name}</p>
                    <p className="text-xs text-muted">
                      {t.block} · {t.flat_number} · {formatCurrency(Number(t.amount))}
                    </p>
                  </div>
                  <StatusBadge label={t.status.replace(/_/g, " ")} tone={STATUS_TONE[t.status] ?? "neutral"} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Block-wise Collection</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {Object.entries(byBlock).length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">No collections yet.</p>
              )}
              {Object.entries(byBlock)
                .sort(([a], [b]) => String(a).localeCompare(String(b)))
                .map(([block, amount]) => (
                <div key={block} className="px-4 py-3 flex items-center justify-between text-sm">
                  <p>{block}</p>
                  <p className="font-semibold">{formatCurrency(amount)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
