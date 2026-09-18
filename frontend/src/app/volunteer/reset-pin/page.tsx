"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

/** Operations-gated — sets a resident's My Stuff PIN directly to a
 *  chosen value in one step. A resident reaches this indirectly, via
 *  the "Forgot PIN" WhatsApp link on My Stuff — the admin picks a new
 *  4-digit PIN and tells them right there in the same conversation,
 *  instead of clearing it and making them come back to set one
 *  themselves. Works the same whether the resident had a PIN before
 *  or never set one at all. */
export default function ChangeResidentPinPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const canChange = volunteer?.permissions.includes("Operations") ?? false;

  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ mobile: string; pin: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    setSubmitting(true);
    try {
      await api.volunteer.adminSetResidentPin(idToken as string, mobile, pin);
      setDone({ mobile, pin });
      setMobile("");
      setPin("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not set PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Change Resident PIN"
        subtitle="Set a resident's My Stuff PIN directly — tell them the new PIN right away"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      {!canChange && <p className="text-sm text-muted">You don&apos;t have access to change PINs.</p>}

      {canChange && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resident&apos;s Mobile</label>
            <MobileInput value={mobile} onChange={setMobile} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">New 4-digit PIN</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-center text-lg tracking-[0.5em]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="text-sm text-green-700">
              PIN for {done.mobile} is now {done.pin} — let them know.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-maroon py-3.5 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
          >
            {submitting ? "Saving…" : "Set PIN"}
          </button>
        </form>
      )}
    </div>
  );
}
