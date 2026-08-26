"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { formatCurrency } from "@/lib/date";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import PageHeader from "@/components/PageHeader";
import PaymentReferenceStep from "@/components/PaymentReferenceStep";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

type Step = "form" | "creating" | "reference" | "submitted" | "cancelled";

export default function DonatePage() {
  const { profile, saveProfile } = useResidentProfile();
  const { data: festival } = useAsync(() => api.festival.get(), []);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fields = {
    name: name || profile.name,
    mobile: mobile || profile.mobile,
    block: block || profile.block,
    flatNumber: flatNumber || profile.flatNumber,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = Number(amount || customAmount);
    if (!amt) {
      setError("Please choose or enter an amount.");
      return;
    }

    setStep("creating");
    try {
      const order = await api.donations.create({
        name: fields.name,
        mobile: fields.mobile,
        email: email || undefined,
        block: fields.block,
        flatNumber: fields.flatNumber,
        amount: amt,
      });
      saveProfile({ name: fields.name, mobile: fields.mobile, block: fields.block, flatNumber: fields.flatNumber });
      setTransactionId(order.transactionId);
      setDonationAmount(order.amount);
      setStep("reference");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setStep("form");
    }
  }

  async function handleSubmitReference(reference: string) {
    if (!transactionId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.donations.submitReference(transactionId, reference);
      setStep("submitted");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not submit your reference. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!transactionId) return;
    setSubmitting(true);
    try {
      await api.donations.cancel(transactionId);
      setStep("cancelled");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not cancel. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "reference" && transactionId) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <PageHeader title="Donate" subtitle={`Transaction ${transactionId}`} />
        <PaymentReferenceStep
          amount={donationAmount}
          festival={festival ?? null}
          onSubmitReference={handleSubmitReference}
          onCancel={handleCancel}
          submitting={submitting}
          error={error}
        />
      </div>
    );
  }

  if (step === "submitted") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader
          title="Thank you!"
          subtitle="Your donation is submitted and waiting for a volunteer to verify the payment. Your receipt will appear under My Stuff once it's confirmed."
        />
      </div>
    );
  }

  if (step === "cancelled") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader title="Donation cancelled" subtitle="No worries — you can start a new donation anytime." />
        <button
          onClick={() => setStep("form")}
          className="rounded-xl bg-saffron px-6 py-3 text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
        >
          Back to Donate
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Donate" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <input
            required
            value={fields.name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mobile</label>
          <input
            required
            type="tel"
            value={fields.mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Block</label>
          <BlockSelect value={fields.block} onChange={setBlock} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Flat (3-digit number only)</label>
          <FlatInput value={fields.flatNumber} onChange={setFlatNumber} />
        </div>

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
          disabled={step === "creating"}
          className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
        >
          {step === "creating"
            ? "Preparing…"
            : `Pay ${amount || customAmount ? formatCurrency(Number(amount || customAmount)) : ""}`}
        </button>
      </form>
    </div>
  );
}
