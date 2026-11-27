"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/date";
import type { FestivalInfo } from "@/lib/types";

/** How a parent pays for a stall's tables and tells us they did: the amount,
 *  the same bank QR and UPI ID the rest of the portal collects money with,
 *  and an optional box for the UPI reference to type in after paying. The
 *  stall is already saved by now, so nothing is lost if they stop here; the
 *  same panel is in My Stuff to come back to. Saving a reference never marks
 *  anything paid: a volunteer checks it against the bank. */
export default function StallPaymentStep({
  amount,
  tables,
  fee,
  festival,
  registrationId,
  mobile,
}: {
  amount: number;
  tables: number;
  fee: number;
  festival: FestivalInfo | null;
  registrationId: string;
  mobile: string;
}) {
  const [copied, setCopied] = useState(false);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api.registrations.addPaymentRef(registrationId, mobile, reference.trim());
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the reference. Please try again.");
    } finally {
      setBusy(false);
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
        <a href="/images/hdfc-vyapar-qr.png" download="payment-qr.png" className="text-xs font-semibold text-maroon underline">
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

      {saved ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
          ✓ Thank you! A volunteer will check your payment.
        </p>
      ) : (
        <div className="space-y-2 border-t border-border pt-3">
          <label className="text-sm font-medium">Paid already? Type your UPI reference / UTR</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 123456789012"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
          <p className="text-xs text-muted">
            Optional now. You can add it later from My Stuff. Your stall request is already saved.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            disabled={busy || !reference.trim()}
            onClick={save}
            className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save payment reference"}
          </button>
        </div>
      )}
    </div>
  );
}
