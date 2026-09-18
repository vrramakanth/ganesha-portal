"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";

/** Operations-gated — the only way a resident's My Stuff PIN ever gets
 *  cleared once set. A resident reaches this indirectly, via the
 *  "Forgot PIN" WhatsApp link on My Stuff; an admin here just clears
 *  it so they can set a fresh one on their next visit. */
export default function ResetPinPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const canReset = volunteer?.permissions.includes("Operations") ?? false;

  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setSubmitting(true);
    try {
      await api.volunteer.resetResidentPin(idToken as string, mobile);
      setDone(mobile);
      setMobile("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not reset PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Reset My Stuff PIN"
        subtitle="Clears a resident's PIN so they can set a new one on their next visit"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      {!canReset && <p className="text-sm text-muted">You don&apos;t have access to reset PINs.</p>}

      {canReset && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resident&apos;s Mobile</label>
            <MobileInput value={mobile} onChange={setMobile} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-green-700">PIN cleared for {done} — they can set a new one next visit.</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-maroon py-3.5 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
          >
            {submitting ? "Resetting…" : "Reset PIN"}
          </button>
        </form>
      )}
    </div>
  );
}
