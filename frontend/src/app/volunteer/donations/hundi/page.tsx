"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import PaymentReferenceStep from "@/components/PaymentReferenceStep";

const QUICK_AMOUNTS = [50, 100, 500, 1000];

type Step = "amount" | "reference" | "logged";

/** The physical Hundi desk near the pandal — a volunteer starts this on
 *  behalf of whoever's in front of them, no name/mobile/block/flat
 *  collected. Never linked from the resident-facing Donate page; this is
 *  a volunteer tool, same spirit as Dinner Walk-in. Same UPI QR →
 *  reference → manual review pipeline as every other donation — a Hundi
 *  offering still needs a Finance volunteer to verify it, it just has no
 *  name attached and no receipt at the end. */
export default function HundiCollectionPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const { data: festival } = useAsync(() => api.festival.get(), []);
  const canCollect = volunteer?.permissions.includes("Finance");

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("amount");
    setAmount("");
    setCustomAmount("");
    setTransactionId(null);
    setDonationAmount(0);
    setError(null);
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount || customAmount);
    if (!amt) {
      setError("Enter an amount.");
      return;
    }
    setSubmitting(true);
    try {
      const order = await api.volunteer.createHundi(idToken as string, amt);
      setTransactionId(order.transactionId);
      setDonationAmount(order.amount);
      setStep("reference");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not start collection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReference(reference: string, screenshot?: string, mimeType?: string) {
    if (!transactionId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.donations.submitReference(transactionId, reference, screenshot, mimeType);
      setStep("logged");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not submit reference. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canCollect) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8">
        <PageHeader title="Hundi Collection" backHref="/volunteer/donations" backLabel="← Donations" />
        <p className="text-sm text-muted">You need Finance permission to log Hundi collections.</p>
      </div>
    );
  }

  if (step === "reference" && transactionId) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <PageHeader title="Hundi Collection" subtitle={`Transaction ${transactionId}`} backHref="/volunteer/donations" backLabel="← Donations" />
        <PaymentReferenceStep
          amount={donationAmount}
          festival={festival ?? null}
          onSubmitReference={handleSubmitReference}
          onCancel={reset}
          submitting={submitting}
          error={error}
        />
      </div>
    );
  }

  if (step === "logged") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 items-center text-center">
        <PageHeader title="Logged" subtitle="Awaiting a Finance volunteer's verification, same as any other donation. No receipt is issued for a Hundi offering." />
        <button
          onClick={reset}
          className="mx-auto rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white active:bg-maroon-dark transition-colors"
        >
          Log Another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Hundi Collection"
        subtitle="For the physical Hundi at the pandal — no name or details, just the amount."
        backHref="/volunteer/donations"
        backLabel="← Donations"
      />

      <form onSubmit={handleStart} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount</label>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setAmount(amt);
                  setCustomAmount("");
                }}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                  amount === amt ? "border-saffron bg-saffron/10 text-saffron-dark" : "border-border text-foreground"
                }`}
              >
                ₹{amt}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            placeholder="Other amount"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setAmount("");
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-maroon py-4 text-center text-lg font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting
            ? "Starting…"
            : `Start Collection ${amount || customAmount ? formatCurrency(Number(amount || customAmount)) : ""}`}
        </button>
      </form>
    </div>
  );
}
