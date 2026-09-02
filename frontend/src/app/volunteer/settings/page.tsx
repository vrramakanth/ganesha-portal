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
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<{ name: string; url: string; created: boolean } | null>(null);

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

  async function handleBackup() {
    setBackupError(null);
    setBackupResult(null);
    setBackingUp(true);
    try {
      const result = await api.volunteer.runBackup(idToken as string);
      setBackupResult(result);
    } catch (err) {
      setBackupError(err instanceof ApiClientError ? err.message : "Could not run backup.");
    } finally {
      setBackingUp(false);
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

      <div className="space-y-2 border-t border-border pt-6">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Backup</h2>
        <p className="text-xs text-muted">
          A copy of the whole spreadsheet runs automatically every day around 8 AM IST. Use this to
          run one right now instead of waiting.
        </p>
        <button
          onClick={handleBackup}
          disabled={backingUp}
          className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon disabled:opacity-60"
        >
          {backingUp ? "Backing up…" : "Backup Now"}
        </button>
        {backupError && <p className="text-sm text-red-600">{backupError}</p>}
        {backupResult && (
          <p className="text-sm text-green-700">
            {backupResult.created ? "Backed up: " : "Already backed up today: "}
            <a href={backupResult.url} target="_blank" rel="noopener noreferrer" className="underline">
              {backupResult.name}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
