"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency, formatEventDate } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

function today() {
  return new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, matches <input type="date">
}

/** Open to any signed-in admin, same as recording an Expense — but this
 *  is a projection, not a claim, so there's no receipt and no approval
 *  step. In place of a receipt, recording requires ticking a
 *  vendor-checked box: a deliberate speed bump so a number only gets
 *  posted after someone's actually checked with the vendor, not typed
 *  from a guess. */
export default function FutureCostsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: estimates, loading: loadingList } = useAsync(
    () => api.volunteer.futureCostsList(idToken as string),
    [idToken, refreshKey]
  );

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [vendorChecked, setVendorChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const total = (estimates ?? []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!purpose.trim()) {
      setError("What's this cost for?");
      return;
    }
    if (!vendorChecked) {
      setError("Confirm you've checked with the vendor before recording this.");
      return;
    }

    setSubmitting(true);
    try {
      await api.volunteer.recordFutureCost(idToken as string, {
        date,
        amount: amountNum,
        purpose: purpose.trim(),
        vendorChecked,
      });
      setAmount("");
      setPurpose("");
      setVendorChecked(false);
      setSaved(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not record this estimate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Future Costs"
        subtitle="Estimated spend not yet incurred — shows as Projected Balance on the Dashboard"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Expected Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Estimated Amount</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 25000"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Purpose</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Caterer — Community Dinner"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <input
            type="checkbox"
            checked={vendorChecked}
            onChange={(e) => setVendorChecked(e.target.checked)}
            className="mt-0.5"
          />
          I&apos;ve checked with the vendor and this amount is close to actuals, based on my understanding.
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={submitting || !vendorChecked}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Saving…" : "Record Estimate"}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">All Estimates</h2>
        {loadingList && <LoadingIndicator />}
        {!loadingList && (estimates ?? []).length === 0 && (
          <p className="text-sm text-muted">No future costs recorded yet.</p>
        )}
        {(estimates ?? []).length > 0 && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {(estimates ?? []).map((e) => (
              <div key={e.estimate_id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{e.purpose}</p>
                  <p className="text-xs text-muted">{formatEventDate(e.date)}</p>
                </div>
                <p className="font-semibold text-maroon">{formatCurrency(Number(e.amount))}</p>
              </div>
            ))}
            <div className="px-4 py-3 flex items-center justify-between gap-2 bg-background">
              <p className="text-sm font-semibold">Total estimated future costs</p>
              <p className="font-semibold text-maroon">{formatCurrency(total)}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
