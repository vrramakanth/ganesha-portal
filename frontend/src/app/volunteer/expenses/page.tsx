"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { fileToBase64 } from "@/lib/file";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

function today() {
  return new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, matches <input type="date">
}

/** Open to any signed-in admin, not just Finance — the point is that
 *  whoever's holding the receipt right now can log it in a couple of
 *  taps instead of routing it through someone else. Reviewing what's
 *  been recorded (approve/reject, reimbursement summary, full list) is
 *  a separate Finance-only page — see /volunteer/expenses/review. */
export default function RecordExpensePage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const canReview = volunteer?.permissions.includes("Finance") ?? false;
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
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not record expense.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Record Expense" backHref="/volunteer" backLabel="← Dashboard" />

      {canReview && (
        <Link href="/volunteer/expenses/review" className="text-xs font-medium text-maroon underline -mt-4">
          Review Expenses →
        </Link>
      )}

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
    </div>
  );
}
