"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

export default function VolunteerBugsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: bugs, loading, error } = useAsync(
    () => api.volunteer.bugsList(idToken as string),
    [idToken, refreshKey]
  );

  const rows = (bugs ?? []).slice().sort((a, b) => (a.reported_at < b.reported_at ? 1 : -1));
  const openCount = rows.filter((b) => b.status === "OPEN").length;

  async function toggleStatus(bugId: string, current: string) {
    setActionError(null);
    setActioning(bugId);
    try {
      const next = current === "OPEN" ? "CLOSED" : "OPEN";
      await api.volunteer.updateBugStatus(idToken as string, bugId, next);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update this bug.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Bug Reports"
        subtitle={`${openCount} open · ${rows.length} total`}
        backHref="/volunteer/more"
        backLabel="← More"
      />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0 && !loading && <p className="px-4 py-3 text-sm text-muted">No bugs reported yet.</p>}
        {rows.map((bug) => (
          <div key={bug.bug_id} className="px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm flex-1">{bug.description}</p>
              <StatusBadge label={bug.status} tone={bug.status === "OPEN" ? "warning" : "success"} />
            </div>
            <p className="text-xs text-muted">
              {bug.bug_id} · {new Date(bug.reported_at).toLocaleString()}
              {bug.reporter_name ? ` · ${bug.reporter_name}` : ""}
            </p>
            {bug.page_url && (
              <p className="text-xs text-muted truncate">From: {bug.page_url}</p>
            )}
            <div className="flex items-center gap-3 pt-1">
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
              <button
                disabled={actioning === bug.bug_id}
                onClick={() => toggleStatus(bug.bug_id, bug.status)}
                className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {bug.status === "OPEN" ? "Mark Closed" : "Reopen"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
