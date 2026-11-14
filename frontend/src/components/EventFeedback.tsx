"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import EventRatingFeedback from "@/components/EventRatingFeedback";
import { useResidentProfile } from "@/lib/useResidentProfile";

const TYPES = [
  { value: "Idea", label: "💡 An idea" },
  { value: "Offer to help", label: "🙋 I can help" },
  { value: "Question", label: "❓ A question" },
  { value: "Feedback", label: "💬 Feedback" },
] as const;
type Type = (typeof TYPES)[number]["value"];

/** A way for residents to send the organisers something about one event:
 *  an idea, an offer to help, a question or feedback. It goes to the festival's
 *  ordinary Feedback list (volunteers with the Content permission read it, and
 *  nothing is shown publicly unless one of them publishes it), tagged with the
 *  kind and the event's name so it's easy to pick out and sort. Before the
 *  event it leans towards ideas; afterwards, towards feedback. */
export default function EventFeedback({ eventName, eventDate }: { eventName: string; eventDate: string }) {
  const { profile } = useResidentProfile();
  // Decided once when the page opens (it can't change while someone is typing).
  const [eventOver] = useState(() => new Date(eventDate).getTime() <= Date.now());
  const [type, setType] = useState<Type>(eventOver ? "Feedback" : "Idea");
  const [text, setText] = useState("");
  const [typedName, setName] = useState<string | null>(null);
  const [typedMobile, setMobile] = useState<string | null>(null);
  const name = typedName ?? profile.name;
  const mobile = typedMobile ?? profile.mobile;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Please share a few words before sending.");
      return;
    }
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      setError("That doesn't look like a valid 10-digit mobile number.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.feedback.submit({
        message: `${type} on ${eventName}\n${text.trim()}`,
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

  // From the day of the event on, ask for a rating and a few quick answers.
  if (eventOver) return <EventRatingFeedback eventName={eventName} />;

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold text-green-700">Thank you! 💛</p>
        <p className="text-muted">
          We read every message
          {type === "Offer to help" || type === "Question" ? " and will get back to you if you gave a mobile number" : ""}.
        </p>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-border bg-card px-3 py-3 text-sm";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{eventOver ? "How was it? Tell us 💬" : "Share your ideas, questions or offers 💬"}</p>
        <p className="text-xs text-muted">
          {eventOver
            ? "What you liked and what could be better. It only takes a minute."
            : "Ideas to make it better, a question, or a hand to help. It only takes a minute."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              type === t.value ? "border-maroon bg-maroon text-white" : "border-border text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            type === "Idea"
              ? "e.g. a stall for face painting, a kids' stall map…"
              : type === "Offer to help"
                ? "e.g. I can help set up tables on the day"
                : type === "Question"
                  ? "What would you like to know?"
                  : "Tell us in your own words…"
          }
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
      <p className="text-xs text-muted">Add your mobile if you&apos;d like a reply, for example for a question or an offer to help.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-maroon py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
