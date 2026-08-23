"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";

export default function AuditLogPage() {
  const { idToken } = useVolunteerAuth();
  const { data: entries, loading, error } = useAsync(
    () => api.volunteer.auditLog(idToken as string),
    [idToken]
  );

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Audit Log" subtitle="Sensitive volunteer actions" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(entries ?? []).length === 0 && !loading && (
          <p className="px-4 py-3 text-sm text-muted">No audited actions yet.</p>
        )}
        {(entries ?? []).map((e, i) => (
          <div key={i} className="px-4 py-3 space-y-1">
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
        ))}
      </div>
    </div>
  );
}
