"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { formatCurrency } from "@/lib/date";
import { fileToBase64 } from "@/lib/file";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

function today() {
  return new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, matches <input type="date">
}

/** Recording is open to any signed-in admin, not just Finance — the
 *  point is that whoever's holding the receipt right now can log it in
 *  a couple of taps instead of routing it through someone else. The
 *  itemized list and settlement summary below are Finance-only, though
 *  — the aggregate total is public (Dashboard's Festival Summary), but
 *  line-item detail (what was bought, by whom) is a Finance concern. */
export default function RecordExpensePage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const canViewList = volunteer?.permissions.includes("Finance") ?? false;
  const { profile, saveProfile, loaded } = useResidentProfile();

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [spenderName, setSpenderName] = useState("");
  const [spenderMobile, setSpenderMobile] = useState("");
  const [upiId, setUpiId] = useState("");
  const [screenshot, setScreenshot] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  // Pre-fills who's spending from this browser's saved profile (same
  // trick used on Donate/Dinner/Seva) — the common case is logging your
  // own expense, so this saves retyping it every time. Still editable
  // in case someone's logging on behalf of another volunteer.
  useEffect(() => {
    if (!loaded) return;
    setSpenderName((prev) => prev || profile.name);
    setSpenderMobile((prev) => prev || profile.mobile);
    setUpiId((prev) => prev || profile.upiId || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const { data: expenses, loading } = useAsync(
    () => (canViewList ? api.volunteer.expensesList(idToken as string) : Promise.resolve(null)),
    [idToken, canViewList, refreshKey]
  );

  const { data: settlement, loading: loadingSettlement } = useAsync(
    () => (canViewList ? api.volunteer.expensesSettlementSummary(idToken as string) : Promise.resolve(null)),
    [idToken, canViewList, refreshKey]
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setScreenshot({ base64, mimeType: file.type || "image/jpeg", name: file.name });
  }

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
      setError("What was this expense for?");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(spenderMobile)) {
      setError("Enter a valid 10-digit mobile number for who spent this.");
      return;
    }

    setSubmitting(true);
    try {
      await api.volunteer.recordExpense(idToken as string, {
        date,
        amount: amountNum,
        purpose: purpose.trim(),
        screenshot: screenshot?.base64,
        mimeType: screenshot?.mimeType,
        spenderName: spenderName.trim(),
        spenderMobile,
        upiId: upiId.trim() || undefined,
      });
      saveProfile({ name: spenderName.trim(), mobile: spenderMobile, upiId: upiId.trim() });
      setAmount("");
      setPurpose("");
      setScreenshot(null);
      setSaved(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not record expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyUpiId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedFor(id);
      setTimeout(() => setCopiedFor(null), 2000);
    } catch {
      // ignore — clipboard access blocked, nothing to fall back to here
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Record Expense" backHref="/volunteer" backLabel="← Dashboard" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1500"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Purpose</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Flowers for decoration"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon"
          >
            {screenshot ? "Receipt Attached ✓" : "Attach Receipt"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Who spent this?</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              value={spenderName}
              onChange={(e) => setSpenderName(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mobile</label>
            <MobileInput value={spenderMobile} onChange={setSpenderMobile} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">UPI ID (optional)</label>
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. name@okhdfcbank"
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
            />
            <p className="text-xs text-muted">So this can be repaid — leave blank if settling in cash.</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Saving…" : "Record Expense"}
        </button>
      </form>

      {canViewList && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Reimbursement Summary</h2>
            <p className="text-xs text-muted">Total owed to each volunteer, so they can be settled in one go.</p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {loadingSettlement && <p className="px-4 py-3 text-sm text-muted">Loading…</p>}
              {!loadingSettlement && settlement?.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">Nothing to settle yet.</p>
              )}
              {settlement?.map((s) => (
                <div key={s.spenderMobile} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{s.spenderName || s.spenderMobile}</p>
                    <p className="text-xs text-muted">
                      {s.spenderMobile} · {s.count} expense{s.count === 1 ? "" : "s"}
                      {s.upiId ? ` · ${s.upiId}` : " · no UPI ID on file"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-semibold text-maroon">{formatCurrency(s.total)}</p>
                    {s.upiId && (
                      <button
                        type="button"
                        onClick={() => copyUpiId(s.upiId)}
                        className="text-xs font-semibold text-maroon underline"
                      >
                        {copiedFor === s.upiId ? "Copied ✓" : "Copy UPI"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Recent Expenses</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {loading && <p className="px-4 py-3 text-sm text-muted">Loading…</p>}
              {!loading && expenses?.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">No expenses recorded yet.</p>
              )}
              {expenses?.map((e) => (
                <div key={e.expense_id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{e.purpose}</p>
                    <p className="text-xs text-muted">
                      {e.date} · {e.spender_name || e.spender_mobile}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-maroon">{formatCurrency(Number(e.amount))}</p>
                    {e.screenshot_url && (
                      <a
                        href={e.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-maroon underline"
                      >
                        Receipt
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
