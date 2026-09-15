"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import type { BugReport } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LoadingIndicator from "@/components/LoadingIndicator";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  CLOSED: "Closed",
};
const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  CLOSED: "success",
};

/** Same "volunteer-reviewed WhatsApp draft, nothing auto-sent" pattern
 *  used for nomination approvals and feedback responses — a courtesy
 *  reach-out, only possible when the reporter left a mobile number. */
function askForInputMessage(bug: BugReport): string {
  const name = bug.reporter_name ? `Hi ${bug.reporter_name}!` : "Hi there!";
  return `${name} Thanks for reporting this on the app: "${bug.description}". We're looking into it — could you share a bit more detail (what you were doing, and on what device/browser)? That'll help us fix it faster. 🙏`;
}

export default function VolunteerBugsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reply, setReply] = useState<{ mobile: string; draft: string } | null>(null);

  const { data: bugs, loading, error } = useAsync(
    () => api.volunteer.bugsList(idToken as string),
    [idToken, refreshKey]
  );

  const rows = (bugs ?? []).slice().sort((a, b) => (a.reported_at < b.reported_at ? 1 : -1));
  const openCount = rows.filter((b) => b.status !== "CLOSED").length;

  async function setStatus(bugId: string, status: "OPEN" | "IN_PROGRESS" | "CLOSED") {
    setActionError(null);
    setActioning(bugId);
    try {
      await api.volunteer.updateBugStatus(idToken as string, bugId, status);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update this bug.");
    } finally {
      setActioning(null);
    }
  }

  function askForInput(bug: BugReport) {
    if (!bug.reporter_mobile) return;
    setReply({ mobile: bug.reporter_mobile, draft: askForInputMessage(bug) });
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Bug Reports"
        subtitle={`${openCount} open · ${rows.length} total`}
        backHref="/volunteer/more"
        backLabel="← More"
      />

      {loading && <LoadingIndicator />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {reply && (
        <section className="space-y-2 rounded-xl border border-maroon/30 bg-maroon/5 p-4">
          <p className="text-sm font-semibold text-maroon">Ask the reporter for more details?</p>
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
        </section>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0 && !loading && <p className="px-4 py-3 text-sm text-muted">No bugs reported yet.</p>}
        {rows.map((bug) => (
          <div key={bug.bug_id} className="px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm flex-1">{bug.description}</p>
              <StatusBadge label={STATUS_LABEL[bug.status] ?? bug.status} tone={STATUS_TONE[bug.status] ?? "neutral"} />
            </div>
            <p className="text-xs text-muted">
              {bug.bug_id} · {new Date(bug.reported_at).toLocaleString()}
              {bug.reporter_name ? ` · ${bug.reporter_name}` : ""}
            </p>
            {bug.page_url && (
              <p className="text-xs text-muted truncate">From: {bug.page_url}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {bug.screenshot_url && (
                <a
                  href={bug.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-maroon"
                >
                  View Screenshot
                </a>
              )}
              {bug.status !== "CLOSED" && bug.reporter_mobile && (
                <button
                  disabled={actioning === bug.bug_id}
                  onClick={() => askForInput(bug)}
                  className="text-xs font-semibold text-maroon disabled:opacity-60"
                >
                  Ask for Input
                </button>
              )}
              <div className="ml-auto flex gap-2">
                {bug.status === "OPEN" && (
                  <button
                    disabled={actioning === bug.bug_id}
                    onClick={() => setStatus(bug.bug_id, "IN_PROGRESS")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    Start Progress
                  </button>
                )}
                {bug.status !== "CLOSED" && (
                  <button
                    disabled={actioning === bug.bug_id}
                    onClick={() => setStatus(bug.bug_id, "CLOSED")}
                    className="rounded-lg bg-maroon px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                  >
                    Mark Closed
                  </button>
                )}
                {bug.status === "CLOSED" && (
                  <button
                    disabled={actioning === bug.bug_id}
                    onClick={() => setStatus(bug.bug_id, "OPEN")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
