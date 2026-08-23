"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { openRazorpayCheckout } from "@/lib/razorpay";
import BlockSelect from "@/components/BlockSelect";
import PageHeader from "@/components/PageHeader";

type Step = "form" | "paying" | "success";

export default function DinnerPage() {
  const { data: events, loading, error: eventsError } = useAsync(() => api.events.list(), []);
  const dinnerDays = (events ?? []).filter((e) => e.category === "Dinner" && e.status === "OPEN");
  const { profile, saveProfile } = useResidentProfile();

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

  const selectedDay = eventId || dinnerDays[0]?.event_id || "";
  const fields = {
    name: name || profile.name,
    mobile: mobile || profile.mobile,
    block: block || profile.block,
    flatNumber: flatNumber || profile.flatNumber,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (adults + children <= 0) {
      setError("At least one meal is required.");
      return;
    }

    setStep("paying");
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

      await openRazorpayCheckout({
        amount: result.amount,
        orderId: result.razorpayOrderId,
        name: "Brigade Woods Community Dinner",
        description: "Dinner meal tokens",
        prefill: { name: fields.name, contact: fields.mobile },
        onSuccess: async (response) => {
          try {
            const confirmed = await api.dinner.confirm({ entitlementId: result.entitlementId, ...response });
            setTokenId(confirmed.tokenId);
            setStep("success");
          } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Could not confirm payment.");
            setStep("form");
          }
        },
        onDismiss: () => setStep("form"),
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setStep("form");
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
            <label className="text-sm font-medium">Block</label>
            <BlockSelect value={fields.block} onChange={setBlock} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Flat</label>
            <input
              required
              value={fields.flatNumber}
              onChange={(e) => setFlatNumber(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
            />
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
            disabled={step === "paying"}
            className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
          >
            {step === "paying" ? "Processing…" : `Register ${adults + children} Meals`}
          </button>
        </form>
      )}
    </div>
  );
}
