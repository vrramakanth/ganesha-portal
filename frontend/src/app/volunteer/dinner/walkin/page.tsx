"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import BlockSelect from "@/components/BlockSelect";
import PageHeader from "@/components/PageHeader";

export default function DinnerWalkinPage() {
  const { idToken } = useVolunteerAuth();
  const { data: events } = useAsync(() => api.events.list(), []);
  const dinnerDays = (events ?? []).filter((e) => e.category === "Dinner");

  const [eventId, setEventId] = useState("");
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [meals, setMeals] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);

  const selectedDay = eventId || dinnerDays[0]?.event_id || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.volunteer.dinnerWalkin(idToken as string, {
        eventId: selectedDay,
        block,
        flatNumber,
        meals,
      });
      setTokenId(result.tokenId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create walk-in token.");
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenId) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center">
        <PageHeader title="Token Generated" />
        <p className="text-2xl font-bold text-maroon">{tokenId}</p>
        <button
          onClick={() => {
            setTokenId(null);
            setBlock("");
            setFlatNumber("");
            setMeals(1);
          }}
          className="mx-auto rounded-lg border border-border px-4 py-2 text-sm font-semibold text-maroon"
        >
          New Walk-in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Walk-in Registration" />

      {dinnerDays.length === 0 ? (
        <p className="text-sm text-muted">No dinner days configured yet.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {dinnerDays.length > 1 && (
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
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Block</label>
            <BlockSelect value={block} onChange={setBlock} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Flat</label>
            <input
              required
              value={flatNumber}
              onChange={(e) => setFlatNumber(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Meals</label>
            <input
              type="number"
              min={1}
              value={meals}
              onChange={(e) => setMeals(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
          >
            {submitting ? "Generating…" : "Generate Token"}
          </button>
        </form>
      )}
    </div>
  );
}
