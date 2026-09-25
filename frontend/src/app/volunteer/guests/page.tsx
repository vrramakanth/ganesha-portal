"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { fileToBase64 } from "@/lib/file";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB — same guard used for the Bug Report screenshot

export default function GuestsAdminPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: guests, loading, error: loadError } = useAsync(() => api.guests.list(), [refreshKey]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (photoFile && photoFile.size > MAX_PHOTO_BYTES) {
      setError("Photo is too large — please pick one under 8MB.");
      return;
    }
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const photoImage = photoFile ? await fileToBase64(photoFile) : undefined;
      await api.volunteer.createGuest(idToken as string, {
        name: String(form.get("name")),
        title: String(form.get("title") || ""),
        sortOrder: Number(form.get("sortOrder")) || 0,
        photoImage,
        mimeType: photoFile?.type,
      });
      setShowForm(false);
      setPhotoFile(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not add this guest.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, guestId: string) {
    e.preventDefault();
    setError(null);
    setSavingEdit(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.volunteer.updateGuest(idToken as string, guestId, {
        name: String(form.get("name")),
        title: String(form.get("title") || ""),
        sortOrder: Number(form.get("sortOrder")) || 0,
      });
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(guestId: string) {
    setError(null);
    setDeletingId(guestId);
    try {
      await api.volunteer.deleteGuest(idToken as string, guestId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not remove this guest.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Guests" subtitle="The public dignitary list" backHref="/volunteer/more" backLabel="← More" />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="shrink-0 rounded-lg bg-saffron px-3 py-2 text-xs font-semibold text-white active:bg-saffron-dark transition-colors"
        >
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <input name="name" required placeholder="Name" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          <input name="title" placeholder="Title / designation (optional)" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Sort order (lower shows first)</label>
            <input name="sortOrder" type="number" defaultValue={0} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-maroon py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add Guest"}
          </button>
        </form>
      )}

      {loading && <LoadingIndicator />}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(guests ?? []).length === 0 && !loading && (
          <p className="px-4 py-3 text-sm text-muted">No guests added yet.</p>
        )}
        {(guests ?? []).map((g) =>
          editingId === g.guest_id ? (
            <form key={g.guest_id} onSubmit={(e) => handleUpdate(e, g.guest_id)} className="px-4 py-3 space-y-2">
              <input name="name" required defaultValue={g.name} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
              <input name="title" defaultValue={g.title} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
              <input
                name="sortOrder"
                type="number"
                defaultValue={g.sort_order}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div key={g.guest_id} className="px-4 py-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {g.photo_url && <img src={g.photo_url} alt={g.name} className="h-10 w-10 rounded-full object-cover border border-border" />}
              <div className="flex-1">
                <p className="font-semibold text-sm">{g.name}</p>
                {g.title && <p className="text-xs text-muted">{g.title}</p>}
              </div>
              <button onClick={() => setEditingId(g.guest_id)} className="text-xs font-semibold text-maroon">
                Edit
              </button>
              <button
                onClick={() => handleDelete(g.guest_id)}
                disabled={deletingId === g.guest_id}
                className="text-xs font-semibold text-red-600 disabled:opacity-60"
              >
                {deletingId === g.guest_id ? "Removing…" : "Remove"}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
