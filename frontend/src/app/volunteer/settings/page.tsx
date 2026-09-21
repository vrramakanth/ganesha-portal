"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

export default function SettingsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [togglingWrap, setTogglingWrap] = useState(false);
  const [wrapError, setWrapError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<{ name: string; url: string; created: boolean } | null>(null);

  const { data: config, loading, error: loadError } = useAsync(
    () => api.volunteer.listConfig(idToken as string),
    [idToken, refreshKey]
  );

  const { data: festivalInfo } = useAsync(() => api.festival.get(), [refreshKey]);
  const wrappedUp = festivalInfo ? festivalInfo.festival_wrapped_up === "true" : null;

  async function handleToggleWrapUp() {
    const wrapping = !wrappedUp;
    if (
      wrapping &&
      !window.confirm(
        "Mark the festival as wrapped up? Residents will no longer be able to RSVP, register for events, upload songs, or sign up for Seva, and Home will show the thank-you summary. Donations have their own switch. You can reverse this any time."
      )
    ) {
      return;
    }
    setWrapError(null);
    setTogglingWrap(true);
    try {
      await api.volunteer.setFestivalWrappedUp(idToken as string, wrapping);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setWrapError(err instanceof ApiClientError ? err.message : "Could not change the festival status.");
    } finally {
      setTogglingWrap(false);
    }
  }

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

      {loading && <LoadingIndicator />}
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

      {wrappedUp !== null && (
        <div className="space-y-2 border-t border-border pt-6">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Festival Wrap-up</h2>
          <p className="text-xs text-muted">
            {wrappedUp
              ? "The festival is marked as wrapped up. Residents see the thank-you summary on Home, and RSVPs, event registration, song uploads and Seva sign-up are closed."
              : "When the festival is over, this closes RSVPs, event registration, song uploads and Seva sign-up, and shows the thank-you summary on Home. Donations have their own switch on the Donations page."}
          </p>
          <button
            onClick={handleToggleWrapUp}
            disabled={togglingWrap}
            className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon disabled:opacity-60"
          >
            {togglingWrap ? "Saving…" : wrappedUp ? "Reopen festival" : "Mark festival as wrapped up"}
          </button>
          {wrapError && <p className="text-sm text-red-600">{wrapError}</p>}
        </div>
      )}

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
