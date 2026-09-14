"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import type { FeedbackReport } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LoadingIndicator from "@/components/LoadingIndicator";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  PUBLISHED: "success",
  DECLINED: "neutral",
};

/** Same "volunteer-reviewed WhatsApp draft, nothing auto-sent" pattern as
 *  nomination approval/rejection (spec §45) — publishing/declining takes
 *  effect immediately either way; this is just a courtesy reply on top,
 *  only possible when the resident left a mobile number. */
function publishedMessage(f: FeedbackReport): string {
  const name = f.reporter_name ? `Hi ${f.reporter_name}!` : "Hi there!";
  return `${name} Thank you for your feedback — we've shared it on the app as part of our "Community Voices" for the whole community to see. We really appreciate you taking the time to write in. 🙏`;
}
function declinedMessage(f: FeedbackReport): string {
  const name = f.reporter_name ? `Hi ${f.reporter_name}!` : "Hi there!";
  return `${name} Thank you so much for sharing your feedback with us. We've taken note of it and it'll help us make things even better. 🙏`;
}

export default function VolunteerFeedbackPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reply, setReply] = useState<{ mobile: string; draft: string } | null>(null);

  const { data: feedback, loading, error } = useAsync(
    () => api.volunteer.feedbackList(idToken as string),
    [idToken, refreshKey]
  );

  const rows = (feedback ?? []).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const pending = rows.filter((f) => f.status === "PENDING");
  const decided = rows.filter((f) => f.status !== "PENDING");

  async function setStatus(f: FeedbackReport, status: "PUBLISHED" | "DECLINED" | "PENDING") {
    setActionError(null);
    setActioning(f.feedback_id);
    try {
      await api.volunteer.updateFeedbackStatus(idToken as string, f.feedback_id, status);
      if (f.reporter_mobile && (status === "PUBLISHED" || status === "DECLINED")) {
        const draft = status === "PUBLISHED" ? publishedMessage(f) : declinedMessage(f);
        setReply({ mobile: f.reporter_mobile, draft });
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update this feedback.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Resident Feedback"
        subtitle={`${pending.length} awaiting review · ${rows.length} total`}
        backHref="/volunteer/more"
        backLabel="← More"
      />

      {loading && <LoadingIndicator />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {reply && (
        <section className="space-y-2 rounded-xl border border-maroon/30 bg-maroon/5 p-4">
          <p className="text-sm font-semibold text-maroon">Send them a reply?</p>
          <textarea
            value={reply.draft}
            onChange={(e) => setReply({ ...reply, draft: e.target.value })}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <a
              href={`https://wa.me/91${reply.mobile}?text=${encodeURIComponent(reply.draft)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setReply(null)}
              className="flex-1 rounded-lg bg-maroon py-2 text-center text-xs font-semibold text-white"
            >
              Send via WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setReply(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
            >
              Skip
            </button>
          </div>
          <p className="text-xs text-muted">
            The decision is already saved — sending this is optional.
          </p>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Needs Review</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {pending.map((f) => (
              <div key={f.feedback_id} className="px-4 py-3 space-y-2">
                <p className="text-sm">{f.message}</p>
                <p className="text-xs text-muted">
                  {f.feedback_id} · {new Date(f.created_at).toLocaleString()}
                  {f.reporter_name ? ` · ${f.reporter_name}` : " · Anonymous"}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    disabled={actioning === f.feedback_id}
                    onClick={() => setStatus(f, "PUBLISHED")}
                    className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                  >
                    Publish to Home
                  </button>
                  <button
                    disabled={actioning === f.feedback_id}
                    onClick={() => setStatus(f, "DECLINED")}
                    className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    Keep Private
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Reviewed</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {decided.length === 0 && <p className="px-4 py-3 text-sm text-muted">Nothing reviewed yet.</p>}
          {decided.map((f) => (
            <div key={f.feedback_id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm flex-1">{f.message}</p>
                <StatusBadge label={f.status} tone={STATUS_TONE[f.status] ?? "neutral"} />
              </div>
              <p className="text-xs text-muted">
                {f.reporter_name || "Anonymous"} · {new Date(f.created_at).toLocaleDateString()}
              </p>
              {f.status === "DECLINED" && (
                <button
                  disabled={actioning === f.feedback_id}
                  onClick={() => setStatus(f, "PUBLISHED")}
                  className="text-xs font-semibold text-maroon disabled:opacity-60"
                >
                  Publish to Home instead
                </button>
              )}
              {f.status === "PUBLISHED" && (
                <button
                  disabled={actioning === f.feedback_id}
                  onClick={() => setStatus(f, "DECLINED")}
                  className="text-xs font-semibold text-maroon disabled:opacity-60"
                >
                  Unpublish
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
