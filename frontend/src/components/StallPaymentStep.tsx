"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/date";
import type { FestivalInfo } from "@/lib/types";

/** Pay-for-tables step for a kids' stall: the same bank QR and UPI ID the
 *  rest of the portal collects money with (the static bank QR image, and the
 *  festival's UPI ID from Settings), the amount due, and a box for the UPI
 *  reference to type in once paid. Nothing here marks anything paid: the
 *  reference is saved with the stall request and a volunteer checks it
 *  against the bank before approving the stall. */
export default function StallPaymentStep({
  amount,
  tables,
  fee,
  festival,
  reference,
  onReference,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  amount: number;
  tables: number;
  fee: number;
  festival: FestivalInfo | null;
  reference: string;
  onReference: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const vpa = festival?.upi_vpa || "";
  const payeeName = festival?.upi_payee_name || festival?.community_name || "Brigade Woods";

  async function copyVpa() {
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="text-center">
        <p className="text-sm font-semibold">Pay for your tables</p>
        <p className="text-2xl font-bold text-maroon">{formatCurrency(amount)}</p>
        <p className="text-xs text-muted">
          {tables} {tables === 1 ? "table" : "tables"} × {formatCurrency(fee)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-3">
        {/* Plain <img>: the exact source file scans more reliably than a
            re-encoded copy, same as on the Donate page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hdfc-vyapar-qr.png" alt="UPI QR code" className="h-auto w-[260px]" />
        <p className="text-xs font-semibold text-maroon">Enter {formatCurrency(amount)} after scanning</p>
        <a
          href="/images/hdfc-vyapar-qr.png"
          download="payment-qr.png"
          className="text-xs font-semibold text-maroon underline"
        >
          Download QR
        </a>
      </div>

      {vpa && (
        <div className="space-y-1 text-center">
          <button
            type="button"
            onClick={copyVpa}
            className="w-full rounded-xl bg-saffron py-3 text-sm font-semibold text-on-saffron active:bg-saffron-dark transition-colors"
          >
            {copied ? "Copied ✓" : "Copy UPI ID"}
          </button>
          <p className="text-xs text-muted">
            Or paste it into your UPI app&apos;s &quot;Pay to UPI ID&quot; option. {payeeName} · {vpa}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">After paying, type your UPI reference / UTR <span className="text-red-600" aria-hidden="true">*</span></label>
        <input
          value={reference}
          onChange={(e) => onReference(e.target.value)}
          placeholder="e.g. 123456789012"
          className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
        />
        <p className="text-xs text-muted">A volunteer checks the payment before confirming your stall.</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={submitting || !reference.trim()}
        onClick={onSubmit}
        className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Submit stall request"}
      </button>
      <button type="button" disabled={submitting} onClick={onBack} className="w-full text-center text-xs font-medium text-muted">
        ← Back to the form
      </button>
    </div>
  );
}
