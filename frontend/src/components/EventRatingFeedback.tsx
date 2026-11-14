"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useResidentProfile } from "@/lib/useResidentProfile";
import { kidsStallIntro } from "@/lib/kidsStallIntro";

const ROLES = ["I took part", "I'm a parent", "I visited"];
const STALL_LIKES = ["The stalls", "Tambola", "Food", "Games", "Arts & crafts", "The kids' energy", "The cause"];
const GENERAL_LIKES = ["The activities", "Food", "Meeting neighbours", "The organisation", "The vibe"];

/** After an event: a short feedback form (stars, who you are, what you liked,
 *  what to improve, ideas for the next events). It is sent as one message to
 *  the festival's ordinary Feedback list, one labelled line per answer, so
 *  volunteers read it in Admin → Feedback like any other feedback. */
export default function EventRatingFeedback({ eventName }: { eventName: string }) {
  const { profile } = useResidentProfile();
  const likes = kidsStallIntro(eventName) ? STALL_LIKES : GENERAL_LIKES;
  const [rating, setRating] = useState(0);
  const [role, setRole] = useState("");
  const [liked, setLiked] = useState<string[]>([]);
  const [improve, setImprove] = useState("");
  const [ideas, setIdeas] = useState("");
  const [typedName, setName] = useState<string | null>(null);
  const [typedMobile, setMobile] = useState<string | null>(null);
  const name = typedName ?? profile.name;
  const mobile = typedMobile ?? profile.mobile;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please tap the stars to rate the event.");
      return;
    }
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      setError("That doesn't look like a valid 10-digit mobile number.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const lines = [
        `Feedback on ${eventName}`,
        `Rating: ${rating}/5`,
        role && `Who: ${role}`,
        liked.length > 0 && `Enjoyed: ${liked.join(", ")}`,
        improve.trim() && `To improve: ${improve.trim()}`,
        ideas.trim() && `Ideas for next events: ${ideas.trim()}`,
      ].filter(Boolean);
      await api.feedback.submit({
        message: lines.join("\n"),
        reporterName: name.trim() || undefined,
        reporterMobile: mobile || undefined,
        pageUrl: window.location.href,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send this. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-green-700">Thank you! 💛</p>
        <p className="text-muted">Your feedback helps us make the next one even better.</p>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-border bg-card px-3 py-3 text-sm";
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-maroon bg-maroon text-white" : "border-border text-foreground"}`;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">How was it? 💬</p>
        <p className="text-xs text-muted">Takes under a minute. Only the stars are required.</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          Your rating <span className="text-red-600" aria-hidden="true">*</span>
        </p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className={`text-3xl leading-none ${n <= rating ? "text-yellow-500" : "text-border"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Who are you?</p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button key={r} type="button" onClick={() => setRole(role === r ? "" : r)} className={chip(role === r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">What did you enjoy? (pick any)</p>
        <div className="flex flex-wrap gap-2">
          {likes.map((l) => {
            const on = liked.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLiked(on ? liked.filter((x) => x !== l) : [...liked, l])}
                className={chip(on)}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">What could be better?</label>
        <textarea rows={3} value={improve} onChange={(e) => setImprove(e.target.value)} className={input} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Any ideas for our next events?</label>
        <textarea
          rows={3}
          value={ideas}
          onChange={(e) => setIdeas(e.target.value)}
          placeholder="e.g. a talent show, a book fair, a sports day…"
          className={input}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mobile (optional)</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className={input}
          />
        </div>
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
