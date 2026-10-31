"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useResidentProfile } from "@/lib/useResidentProfile";

/** "What's working, what's not" for one event. Goes to the festival's
 *  ordinary Feedback list (volunteers with the Content permission read it,
 *  and nothing is shown publicly unless one of them chooses to publish it),
 *  tagged with the event's name so it's easy to pick out. */
export default function EventFeedback({ eventName }: { eventName: string }) {
  const { profile } = useResidentProfile();
  const [feedback, setFeedback] = useState("");
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? profile.name;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim()) {
      setError("Please share a few words before sending.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const message = `Feedback on ${eventName}\n${feedback.trim()}`;
      await api.feedback.submit({
        message,
        reporterName: name.trim() || undefined,
        pageUrl: window.location.href,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-green-700">Thank you! 💛</p>
        <p className="text-muted">We read every message, and it helps us make the next one even better.</p>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-border bg-card px-3 py-3 text-sm";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">How was it? Tell us 💬</p>
        <p className="text-xs text-muted">What you liked and what could be better. It only takes a minute.</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">👍 What you liked, 👎 what could be better</label>
        <textarea
          rows={5}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us in your own words…"
          className={input}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Your name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
