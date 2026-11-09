"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { parsePayment } from "@/lib/stallNeeds";
import type { EventRegistration } from "@/lib/types";

/** For an organiser: record the UPI reference for a stall's table fee after
 *  matching it in the bank record, which marks the payment verified. Used when
 *  a parent paid but didn't type the reference, or sent the stall before the
 *  payment step existed. Hidden once a payment is verified. */
export default function StallPaymentControl({
  registration: r,
  idToken,
  onSaved,
}: {
  registration: EventRegistration;
  idToken: string;
  onSaved: () => void;
}) {
  const payment = parsePayment(r.comments);
  const [ref, setRef] = useState(payment.ref);
  const [amount, setAmount] = useState(payment.fee ? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (payment.verified) return null;

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api.volunteer.recordStallPayment(idToken, r.registration_id, ref.trim(), payment.fee ? undefined : Number(amount) || undefined);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold">Record payment</p>
      <p className="text-xs text-muted">Match it in the bank record first, then enter the UTR here.</p>
      <div className="grid grid-cols-3 gap-2">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="UPI ref / UTR"
          className={`${payment.fee ? "col-span-3" : "col-span-2"} rounded-lg border border-border bg-card px-3 py-2 text-xs`}
        />
        {!payment.fee && (
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="₹ paid"
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
          />
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || !ref.trim()}
        onClick={save}
        className="w-full rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Mark payment verified"}
      </button>
    </div>
  );
}
