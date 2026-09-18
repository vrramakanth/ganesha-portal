"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import type { AuditLogEntry } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

function EntryRow({ e }: { e: AuditLogEntry }) {
  return (
    <div className="px-4 py-3 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{new Date(e.timestamp).toLocaleString()}</p>
        <p className="text-xs text-muted">{e.volunteer_id}</p>
      </div>
      <p className="text-sm font-semibold">{e.action}</p>
      <p className="text-xs text-muted">
        {e.entity} {e.entity_id}
      </p>
      {(e.old_value || e.new_value) && (
        <p className="text-xs font-mono text-maroon">
          {e.old_value} → {e.new_value}
        </p>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);

  const { data: entries, loading, error } = useAsync(
    () => api.volunteer.auditLog(idToken as string),
    [idToken, refreshKey]
  );
  const { data: archivedEntries, loading: loadingArchived } = useAsync(
    () => (showOlder ? api.volunteer.archivedAuditLog(idToken as string) : Promise.resolve(null)),
    [idToken, showOlder]
  );

  async function handleArchive() {
    setArchiveError(null);
    setArchiveMessage(null);
    setArchiving(true);
    try {
      const result = await api.volunteer.archiveAuditLog(idToken as string);
      setArchiveMessage(
        result.archivedCount > 0
          ? `Archived ${result.archivedCount} older entries — ${result.remainingCount} kept here.`
          : "Nothing to archive yet."
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setArchiveError(err instanceof ApiClientError ? err.message : "Could not archive entries.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Audit Log"
        subtitle="Sensitive organizer actions"
        backHref="/volunteer/more"
        backLabel="← More"
      />

      <div className="flex items-center justify-between gap-2 -mt-4">
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving}
          className="text-xs font-medium text-maroon underline disabled:opacity-60"
        >
          {archiving ? "Archiving…" : "Archive Older Entries"}
        </button>
      </div>
      {archiveError && <p className="text-sm text-red-600">{archiveError}</p>}
      {archiveMessage && <p className="text-sm text-green-700">{archiveMessage}</p>}

      {loading && <LoadingIndicator />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(entries ?? []).length === 0 && !loading && (
          <p className="px-4 py-3 text-sm text-muted">No audited actions yet.</p>
        )}
        {(entries ?? []).map((e, i) => (
          <EntryRow key={i} e={e} />
        ))}
      </div>

      {!showOlder ? (
        <button
          type="button"
          onClick={() => setShowOlder(true)}
          className="text-center text-xs font-medium text-maroon underline"
        >
          Show older entries →
        </button>
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Archived Entries</h2>
          {loadingArchived && <LoadingIndicator />}
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {(archivedEntries ?? []).length === 0 && !loadingArchived && (
              <p className="px-4 py-3 text-sm text-muted">No archived entries yet.</p>
            )}
            {(archivedEntries ?? []).map((e, i) => (
              <EntryRow key={i} e={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
