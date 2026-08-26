"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

type Result = { registrationId: string; alreadyCheckedIn: boolean; checkedInAt: string };

export default function EventCheckinPage() {
  const { idToken } = useVolunteerAuth();
  const eventId = useSearchParams().get("event");

  const [registrationId, setRegistrationId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await api.volunteer.checkIn(idToken as string, registrationId.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not check in this registration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Event Check-in"
        subtitle={eventId ? `Event: ${eventId}` : "Enter a registration ID to check in"}
        backHref="/volunteer/events"
        backLabel="← Events"
      />

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          required
          value={registrationId}
          onChange={(e) => setRegistrationId(e.target.value)}
          placeholder="Registration ID"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-maroon px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "…" : "Check In"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <StatusBadge
            label={result.alreadyCheckedIn ? "ALREADY CHECKED IN" : "CHECKED IN"}
            tone={result.alreadyCheckedIn ? "neutral" : "success"}
          />
          <p className="text-sm text-muted">
            {result.registrationId} · {new Date(result.checkedInAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
