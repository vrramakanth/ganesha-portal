"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useResidentProfile } from "@/lib/useResidentProfile";
import type { EventRegistration } from "@/lib/types";
import BlockSelect from "@/components/BlockSelect";
import FlatInput from "@/components/FlatInput";
import PageHeader from "@/components/PageHeader";

export default function EventDetailClient({ eventId }: { eventId: string }) {
  const { data: events, loading, error } = useAsync(() => api.events.list(), []);
  const event = (events ?? []).find((e) => e.event_id === eventId);
  const { profile, saveProfile } = useResidentProfile();

  const [participantName, setParticipantName] = useState("");
  const [participantAge, setParticipantAge] = useState("");
  const [mobile, setMobile] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);

  if (loading) return <p className="px-5 pt-8 text-sm text-muted">Loading event…</p>;
  if (error) return <p className="px-5 pt-8 text-sm text-red-600">{error}</p>;
  if (!event) return <p className="px-5 pt-8 text-sm text-muted">Event not found.</p>;

  const fields = {
    participantName: participantName || profile.name,
    mobile: mobile || profile.mobile,
    block: block || profile.block,
    flatNumber: flatNumber || profile.flatNumber,
  };

  const canRegister = event.status === "OPEN" && Number(event.fee || 0) === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await api.events.register({
        eventId,
        participantName: fields.participantName,
        participantAge,
        block: fields.block,
        flatNumber: fields.flatNumber,
        mobile: fields.mobile,
      });
      saveProfile({ name: fields.participantName, mobile: fields.mobile, block: fields.block, flatNumber: fields.flatNumber });
      setRegistration(result);
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (registration) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8 items-center text-center">
        <PageHeader title="You're registered!" subtitle={event.name} />
        <div className="rounded-xl border border-border bg-card p-6">
          <QRCodeSVG value={registration.registration_id} size={180} />
        </div>
        <p className="text-sm text-muted">Registration ID: {registration.registration_id}</p>
        <p className="text-sm text-muted">Show this QR at the event entrance for check-in.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title={event.name}
        subtitle={`${event.date} · ${event.start_time} · ${event.location}`}
      />
      {event.description && <p className="text-sm text-muted">{event.description}</p>}

      {!canRegister && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          {event.status !== "OPEN"
            ? "Registration is not currently open for this event."
            : "Registration for paid events is coming soon."}
        </p>
      )}

      {canRegister && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Participant Name</label>
            <input
              required
              value={fields.participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
            />
          </div>
          {event.age_group && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Age</label>
              <input
                value={participantAge}
                onChange={(e) => setParticipantAge(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
              />
            </div>
          )}
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
            <label className="text-sm font-medium">Flat (3-digit number only)</label>
            <FlatInput value={fields.flatNumber} onChange={setFlatNumber} />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-saffron py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-saffron-dark transition-colors"
          >
            {submitting ? "Registering…" : "Register"}
          </button>
        </form>
      )}
    </div>
  );
}
