"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency } from "@/lib/date";
import type { CommunityDinnerRegistration } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LoadingIndicator from "@/components/LoadingIndicator";

const STATUS_TONE: Record<string, BadgeTone> = {
  CONFIRMED: "success",
  PAYMENT_PENDING: "info",
  MANUAL_REVIEW: "warning",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

type EditFields = {
  resident_name: string;
  mobile: string;
  block: string;
  flat_number: string;
  adults: string;
  children: string;
  guest_adults: string;
  guest_children: string;
};

function toEditFields(r: CommunityDinnerRegistration): EditFields {
  return {
    resident_name: r.resident_name,
    mobile: r.mobile,
    block: r.block,
    flat_number: r.flat_number,
    adults: String(r.adults),
    children: String(r.children),
    guest_adults: String(r.guest_adults),
    guest_children: String(r.guest_children),
  };
}

/** Payment review (Finance) and the general roster/edit tool (Dinner)
 *  are independently gated and independently fetched — mirrors the
 *  "money needs Finance, ops don't" split used for Expenses — so an
 *  admin with only one of the two still sees what they can act on. */
export default function VolunteerCommunityDinnerPage() {
  const { idToken, volunteer } = useVolunteerAuth();
  const hasDinner = volunteer?.permissions.includes("Dinner") ?? false;
  const hasFinance = volunteer?.permissions.includes("Finance") ?? false;
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: allRegistrations, loading: loadingAll } = useAsync(
    () => (hasDinner ? api.volunteer.communityDinnerList(idToken as string) : Promise.resolve([])),
    [idToken, hasDinner, refreshKey]
  );
  const { data: needsReview, loading: loadingReview } = useAsync(
    () => (hasFinance ? api.volunteer.communityDinnerPayments(idToken as string) : Promise.resolve([])),
    [idToken, hasFinance, refreshKey]
  );

  const registrations = allRegistrations ?? [];
  const confirmed = registrations.filter((r) => r.status === "CONFIRMED");
  const totalGuestRevenue = confirmed.reduce((sum, r) => sum + Number(r.guest_amount || 0), 0);
  const totalHeads = confirmed.reduce(
    (sum, r) => sum + r.adults + r.children + r.guest_adults + r.guest_children,
    0
  );

  async function handleApprove(registrationId: string) {
    setActionError(null);
    setActioning(registrationId);
    try {
      await api.volunteer.approveCommunityDinnerPayment(idToken as string, registrationId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not approve payment.");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(registrationId: string) {
    setActionError(null);
    setActioning(registrationId);
    try {
      await api.volunteer.rejectCommunityDinnerPayment(idToken as string, registrationId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject payment.");
    } finally {
      setActioning(null);
    }
  }

  function startEdit(r: CommunityDinnerRegistration) {
    setEditingId(r.registration_id);
    setEditFields(toEditFields(r));
  }

  async function saveEdit(registrationId: string) {
    if (!editFields) return;
    setActionError(null);
    setSavingEdit(true);
    try {
      await api.volunteer.editCommunityDinnerRegistration(idToken as string, registrationId, {
        resident_name: editFields.resident_name,
        mobile: editFields.mobile,
        block: editFields.block,
        flat_number: editFields.flat_number,
        adults: Number(editFields.adults) || 0,
        children: Number(editFields.children) || 0,
        guest_adults: Number(editFields.guest_adults) || 0,
        guest_children: Number(editFields.guest_children) || 0,
      });
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Community Dinner"
        subtitle="Registrations, guest payments, and edits"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      {!hasDinner && !hasFinance && (
        <p className="text-sm text-muted">You don&apos;t have access to Community Dinner registrations.</p>
      )}
      {(loadingAll || loadingReview) && <LoadingIndicator />}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {hasDinner && allRegistrations && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile value={String(registrations.length)} label="Registrations" />
          <StatTile value={String(totalHeads)} label="Total Attending (confirmed)" />
          <StatTile value={formatCurrency(totalGuestRevenue)} label="Guest Revenue (confirmed)" />
          <StatTile value={String((needsReview ?? []).length)} label="Needs Review" />
        </div>
      )}

      {hasFinance && needsReview && needsReview.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Needs Review</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {needsReview.map((r) => (
              <div key={r.registration_id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{r.resident_name}</p>
                    <p className="text-xs text-muted">
                      {r.block} · {r.flat_number} · {r.mobile}
                    </p>
                    <p className="text-xs text-muted">
                      Guests: {r.guest_adults} adult{r.guest_adults === 1 ? "" : "s"}, {r.guest_children} child
                      {r.guest_children === 1 ? "" : "ren"}
                    </p>
                    {r.payment_reference && <p className="text-xs text-muted">Ref: {r.payment_reference}</p>}
                  </div>
                  <p className="font-semibold text-maroon shrink-0">{formatCurrency(Number(r.guest_amount))}</p>
                </div>
                {r.payment_screenshot_url && (
                  <a
                    href={r.payment_screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-semibold text-maroon"
                  >
                    View Screenshot
                  </a>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={actioning === r.registration_id}
                    onClick={() => handleApprove(r.registration_id)}
                    className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    disabled={actioning === r.registration_id}
                    onClick={() => handleReject(r.registration_id)}
                    className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasDinner && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">All Registrations</h2>
          <p className="text-xs text-muted">
            Edits here are for WhatsApp-requested changes — residents can&apos;t self-edit once registered.
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {registrations.length === 0 && !loadingAll && (
              <p className="px-4 py-3 text-sm text-muted">No registrations yet.</p>
            )}
            {registrations.map((r) =>
              editingId === r.registration_id && editFields ? (
                <div key={r.registration_id} className="px-4 py-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editFields.resident_name}
                      onChange={(e) => setEditFields({ ...editFields, resident_name: e.target.value })}
                      placeholder="Name"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      value={editFields.mobile}
                      onChange={(e) => setEditFields({ ...editFields, mobile: e.target.value })}
                      placeholder="Mobile"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      value={editFields.block}
                      onChange={(e) => setEditFields({ ...editFields, block: e.target.value.toUpperCase() })}
                      placeholder="Block"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      value={editFields.flat_number}
                      onChange={(e) => setEditFields({ ...editFields, flat_number: e.target.value })}
                      placeholder="Flat"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      value={editFields.adults}
                      onChange={(e) => setEditFields({ ...editFields, adults: e.target.value })}
                      placeholder="Adults"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      value={editFields.children}
                      onChange={(e) => setEditFields({ ...editFields, children: e.target.value })}
                      placeholder="Children"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      value={editFields.guest_adults}
                      onChange={(e) => setEditFields({ ...editFields, guest_adults: e.target.value })}
                      placeholder="Guest Adults"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      value={editFields.guest_children}
                      onChange={(e) => setEditFields({ ...editFields, guest_children: e.target.value })}
                      placeholder="Guest Children"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => saveEdit(r.registration_id)}
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
                </div>
              ) : (
                <div key={r.registration_id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{r.resident_name}</p>
                      <p className="text-xs text-muted">
                        {r.block} · {r.flat_number} · {r.mobile}
                      </p>
                      <p className="text-xs text-muted">
                        {r.adults} adult{r.adults === 1 ? "" : "s"}, {r.children} child{r.children === 1 ? "" : "ren"}
                        {(r.guest_adults > 0 || r.guest_children > 0) &&
                          ` + ${r.guest_adults} guest adult${r.guest_adults === 1 ? "" : "s"}, ${r.guest_children} guest child${r.guest_children === 1 ? "" : "ren"}`}
                      </p>
                    </div>
                    <StatusBadge label={r.status.replace(/_/g, " ")} tone={STATUS_TONE[r.status] ?? "neutral"} />
                  </div>
                  <button
                    onClick={() => startEdit(r)}
                    className="text-xs font-semibold text-maroon"
                  >
                    Edit
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
