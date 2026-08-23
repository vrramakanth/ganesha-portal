"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";

const REPORTS = [
  { key: "donations", label: "Donation report" },
  { key: "registrations", label: "Event registrations" },
  { key: "dinner", label: "Dinner entitlements" },
  { key: "volunteers", label: "Volunteers" },
];

export default function ReportsPage() {
  const { idToken } = useVolunteerAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportReport(key: string) {
    setError(null);
    setBusy(key);
    try {
      const { filename, csv } = await api.volunteer.exportReport(idToken as string, key);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not export report.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Reports" subtitle="Export as CSV" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {REPORTS.map((r) => (
          <div key={r.key} className="px-4 py-3 flex items-center justify-between gap-2">
            <p className="text-sm">{r.label}</p>
            <button
              disabled={busy === r.key}
              onClick={() => exportReport(r.key)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-maroon disabled:opacity-60"
            >
              {busy === r.key ? "Exporting…" : "Export"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
