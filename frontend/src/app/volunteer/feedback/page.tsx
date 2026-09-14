"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LoadingIndicator from "@/components/LoadingIndicator";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  PUBLISHED: "success",
  DECLINED: "neutral",
};

export default function VolunteerFeedbackPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: feedback, loading, error } = useAsync(
    () => api.volunteer.feedbackList(idToken as string),
    [idToken, refreshKey]
  );

  const rows = (feedback ?? []).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const pending = rows.filter((f) => f.status === "PENDING");
  const decided = rows.filter((f) => f.status !== "PENDING");

  async function setStatus(feedbackId: string, status: "PUBLISHED" | "DECLINED" | "PENDING") {
    setActionError(null);
    setActioning(feedbackId);
    try {
      await api.volunteer.updateFeedbackStatus(idToken as string, feedbackId, status);
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
                    onClick={() => setStatus(f.feedback_id, "PUBLISHED")}
                    className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                  >
                    Publish to Home
                  </button>
                  <button
                    disabled={actioning === f.feedback_id}
                    onClick={() => setStatus(f.feedback_id, "DECLINED")}
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
                  onClick={() => setStatus(f.feedback_id, "PUBLISHED")}
                  className="text-xs font-semibold text-maroon disabled:opacity-60"
                >
                  Publish to Home instead
                </button>
              )}
              {f.status === "PUBLISHED" && (
                <button
                  disabled={actioning === f.feedback_id}
                  onClick={() => setStatus(f.feedback_id, "DECLINED")}
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
