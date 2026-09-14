"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useResidentProfile } from "@/lib/useResidentProfile";
import PageHeader from "@/components/PageHeader";

type Step = "form" | "done";

export default function FeedbackPage() {
  const { profile } = useResidentProfile();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile.name);
    setPageUrl(document.referrer || window.location.href);
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please share a few words before sending.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.feedback.submit({
        message: message.trim(),
        reporterName: name.trim() || undefined,
        reporterMobile: profile.mobile || undefined,
        pageUrl,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send your feedback — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8 text-center items-center">
        <PageHeader title="Thank You!" backHref="/more" backLabel="← More" />
        <p className="text-sm text-muted">
          We read every message — thanks for helping us make next year even better.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="We're Listening"
        subtitle="Tell us what you loved, and what we could do better."
        backHref="/more"
        backLabel="← More"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <textarea
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share your thoughts, ideas, or anything we could improve..."
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Your name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="So we know who to thank"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Sending…" : "Send Feedback"}
        </button>
        <p className="text-xs text-muted text-center">
          Reviewed by the organizing team first — nothing is shared publicly without a look.
        </p>
      </form>
    </div>
  );
}
