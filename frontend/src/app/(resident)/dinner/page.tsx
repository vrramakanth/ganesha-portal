"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";
import PaymentReferenceStep from "@/components/PaymentReferenceStep";

type Step = "form" | "registering" | "reference" | "submitted" | "cancelled" | "success";

export default function DinnerPage() {
  const { data: events, loading, error: eventsError } = useAsync(() => api.events.list(), []);
  const { data: festival } = useAsync(() => api.festival.get(), []);
  const dinnerDays = (events ?? []).filter((e) => e.category === "Dinner" && e.status === "OPEN");
  const { profile, saveProfile, loaded } = useResidentProfile();

  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [entitlementId, setEntitlementId] = useState<string | null>(null);
  const [mealAmount, setMealAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // One-time hydration from the saved profile once it loads — see Donate
  // page for why: without this, fields || profile.x can never be cleared
  // to empty, since "" is falsy and falls straight back to the saved value.
  useEffect(() => {
    if (!loaded) return;
    setName((prev) => prev || profile.name);
    setMobile((prev) => prev || profile.mobile);
    setBlock((prev) => prev || profile.block);
    setFlatNumber((prev) => prev || profile.flatNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const selectedDay = eventId || dinnerDays[0]?.event_id || "";
  const fields = { name, mobile, block, flatNumber };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(fields.mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (adults + children <= 0) {
      setError("At least one meal is required.");
      return;
    }

    setStep("registering");
    try {
      const result = await api.dinner.register({
        eventId: selectedDay,
        name: fields.name,
        mobile: fields.mobile,
        block: fields.block,
        flatNumber: fields.flatNumber,
        adults,
        children,
      });
      saveProfile({ name: fields.name, mobile: fields.mobile, block: fields.block, flatNumber: fields.flatNumber });

      if (!result.paymentRequired) {
        setTokenId(result.tokenId);
        setStep("success");
        return;
      }

      setEntitlementId(result.entitlementId);
      setMealAmount(result.amount);
      setStep("reference");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setStep("form");
    }
  }

  async function handleSubmitReference(reference: string) {
    if (!entitlementId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.dinner.submitReference(entitlementId, reference);
      setStep("submitted");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not submit your reference. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!entitlementId) return;
    setSubmitting(true);
    try {
      await api.dinner.cancel(entitlementId);
      setStep("cancelled");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not cancel. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "success" && tokenId) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader title="Dinner token ready!" subtitle={`${adults + children} meals reserved`} />
        <div className="rounded-xl border border-border bg-card p-6">
          <QRCodeSVG value={tokenId} size={180} />
        </div>
        <p className="text-sm text-muted">Token: {tokenId}</p>
        <p className="text-sm text-muted">Show this QR at the dinner counter.</p>
      </div>
    );
  }

  if (step === "reference" && entitlementId) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <PageHeader title="Community Dinner" subtitle={`${adults + children} meals`} />
        <PaymentReferenceStep
          amount={mealAmount}
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
          subtitle="Your dinner registration is submitted and waiting for a volunteer to verify the payment. Your meal token will appear under My Stuff once it's confirmed."
        />
      </div>
    );
  }

  if (step === "cancelled") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader title="Registration cancelled" subtitle="No worries — you can register again anytime." />
        <button
          onClick={() => setStep("form")}
          className="rounded-xl bg-saffron px-6 py-3 text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
        >
          Back to Dinner
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Community Dinner" />

      {loading && <p className="text-sm text-muted">Loading dinner days…</p>}
      {eventsError && <p className="text-sm text-red-600">{eventsError}</p>}
      {!loading && dinnerDays.length === 0 && (
        <p className="text-sm text-muted">Dinner registration is not open yet.</p>
      )}

      {dinnerDays.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {dinnerDays.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Day</label>
              <select
                value={selectedDay}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
              >
                {dinnerDays.map((d) => (
                  <option key={d.event_id} value={d.event_id}>
                    {d.name} — {d.date}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              required
              value={fields.name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mobile</label>
            <MobileInput value={fields.mobile} onChange={setMobile} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Block</label>
            <BlockSelect value={fields.block} onChange={setBlock} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Flat (3-digit number only)</label>
            <FlatInput value={fields.flatNumber} onChange={setFlatNumber} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Adults</label>
              <input
                type="number"
                min={0}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Children</label>
              <input
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={step === "registering"}
            className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
          >
            {step === "registering" ? "Processing…" : `Register ${adults + children} Meals`}
          </button>
        </form>
      )}
    </div>
  );
}
