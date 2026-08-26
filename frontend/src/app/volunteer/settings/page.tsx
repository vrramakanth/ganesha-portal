"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";

export default function SettingsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: config, loading, error: loadError } = useAsync(
    () => api.volunteer.listConfig(idToken as string),
    [idToken, refreshKey]
  );

  async function handleSave() {
    if (Object.keys(edits).length === 0) return;
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await api.volunteer.updateConfig(idToken as string, edits);
      setEdits({});
      setSaved(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Settings" subtitle="Festival configuration" backHref="/volunteer/more" backLabel="← More" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {config && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {config.map((c) => (
            <div key={c.key} className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted shrink-0">{c.key}</p>
              <input
                defaultValue={c.value}
                onChange={(e) => setEdits((prev) => ({ ...prev, [c.key]: e.target.value }))}
                className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm text-right"
              />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        onClick={handleSave}
        disabled={saving || Object.keys(edits).length === 0}
        className="w-full rounded-xl bg-maroon py-3 text-center text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
