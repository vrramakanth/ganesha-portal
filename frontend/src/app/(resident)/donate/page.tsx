"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { formatCurrency } from "@/lib/date";
import BlockSelect from "@/components/BlockSelect";
import PageHeader from "@/components/PageHeader";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

type Step = "form" | "paying" | "success";

export default function DonatePage() {
  const { profile, saveProfile } = useResidentProfile();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const fields = {
    name: name || profile.name,
    mobile: mobile || profile.mobile,
    block: block || profile.block,
    flatNumber: flatNumber || profile.flatNumber,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const donationAmount = Number(amount || customAmount);
    if (!donationAmount) {
      setError("Please choose or enter an amount.");
      return;
    }

    setStep("paying");
    try {
      const order = await api.donations.create({
        name: fields.name,
        mobile: fields.mobile,
        email: email || undefined,
        block: fields.block,
        flatNumber: fields.flatNumber,
        amount: donationAmount,
      });
      saveProfile({ name: fields.name, mobile: fields.mobile, block: fields.block, flatNumber: fields.flatNumber });

      await openRazorpayCheckout({
        amount: order.amount,
        orderId: order.razorpayOrderId,
        name: "Brigade Woods Ganesha Chathurthi",
        description: "Festival Donation",
        prefill: { name: fields.name, contact: fields.mobile, email },
        onSuccess: async (response) => {
          try {
            const confirmed = await api.donations.confirm({
              transactionId: order.transactionId,
              ...response,
            });
            setReceiptUrl(confirmed.receiptUrl);
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

  if (step === "success") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader title="Thank you for contributing!" subtitle="Your donation was successful." />
        {receiptUrl && (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs rounded-xl bg-maroon py-3 text-center text-sm font-semibold text-white"
          >
            View Receipt
          </a>
        )}
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
          <label className="text-sm font-medium">Flat</label>
          <input
            required
            value={fields.flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
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
          disabled={step === "paying"}
          className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
        >
          {step === "paying"
            ? "Opening payment…"
            : `Pay ${amount || customAmount ? formatCurrency(Number(amount || customAmount)) : ""}`}
        </button>
      </form>
    </div>
  );
}
