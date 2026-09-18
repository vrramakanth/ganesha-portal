"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { fileToBase64 } from "@/lib/file";
import { formatCurrency } from "@/lib/date";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

/** Sponsors often aren't residents and pay outside the app, so an admin
 *  records the payment here. It goes to Needs Review on Donations, where
 *  it's verified against the bank statement and a receipt is issued —
 *  recording alone never counts it toward the collection. */
export default function RecordSponsorshipPage() {
  const { idToken } = useVolunteerAuth();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<{ transactionId: string; name: string; amount: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = Number(amount);
    if (!name.trim()) {
      setError("Enter the sponsor's name.");
      return;
    }
    if (!(amountNum > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!reference.trim()) {
      setError("Enter a payment reference, e.g. UTR, cheque number, or 'Cash'.");
      return;
    }
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number, or leave it blank.");
      return;
    }

    setSubmitting(true);
    try {
      const screenshot = file ? await fileToBase64(file) : undefined;
      const result = await api.volunteer.recordSponsorship(idToken as string, {
        name: name.trim(),
        mobile: mobile || undefined,
        amount: amountNum,
        reference: reference.trim(),
        notes: notes.trim() || undefined,
        screenshot,
        mimeType: file?.type,
      });
      setRecorded({ transactionId: result.transactionId, name: name.trim(), amount: amountNum });
      setName("");
      setMobile("");
      setAmount("");
      setReference("");
      setNotes("");
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not record this sponsorship.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Record Sponsorship"
        subtitle="For sponsors who paid outside the app — it's then verified on Donations"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      {recorded && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-2">
          <p className="font-semibold text-green-700">
            Recorded {formatCurrency(recorded.amount)} from {recorded.name}
          </p>
          <p className="text-muted">
            {recorded.transactionId} is waiting under Needs Review. Verify it there to issue the receipt.
          </p>
          <Link href="/volunteer/donations" className="inline-block font-semibold text-maroon underline">
            Go to Review Payments
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Sponsor name (individual or business)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mobile (optional)</label>
          <MobileInput value={mobile} onChange={setMobile} required={false} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount</label>
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
          <label className="text-sm font-medium">Payment reference</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="UTR, cheque number, or Cash"
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Screenshot or proof (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Sponsoring Saturday's Maha Prasadam"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Saving…" : "Record Sponsorship"}
        </button>
      </form>
    </div>
  );
}
