"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

export default function AnnouncementsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: announcements, loading, error: loadError } = useAsync(
    () => api.announcements.list(),
    [refreshKey]
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.volunteer.createAnnouncement(idToken as string, {
        title: String(form.get("title")),
        message: String(form.get("message")),
      });
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not publish announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(id: string) {
    setError(null);
    try {
      await api.volunteer.deactivateAnnouncement(idToken as string, id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not deactivate.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Announcements" backHref="/volunteer/more" backLabel="← More" />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="shrink-0 rounded-lg bg-saffron px-3 py-2 text-xs font-semibold text-white active:bg-saffron-dark transition-colors"
        >
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <input name="title" required placeholder="Title" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          <textarea name="message" required placeholder="Message" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-maroon py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(announcements ?? []).length === 0 && !loading && (
          <p className="px-4 py-3 text-sm text-muted">No announcements yet.</p>
        )}
        {(announcements ?? []).map((a) => (
          <div key={a.announcement_id} className="px-4 py-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm">{a.title}</p>
              <StatusBadge label="ACTIVE" tone="success" />
            </div>
            <p className="text-xs text-muted">{a.message}</p>
            <button onClick={() => deactivate(a.announcement_id)} className="text-xs font-semibold text-maroon">
              Deactivate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
