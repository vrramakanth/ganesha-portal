"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency, formatEventDate, toDateInputValue } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";
import StatusBadge from "@/components/StatusBadge";
import type { FutureCost } from "@/lib/types";
import DraftExpenseEditor from "./DraftExpenseEditor";

function today() {
  return new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, matches <input type="date">
}

/** Open to any signed-in admin, same as recording an Expense — but this
 *  is a projection, not a claim, so there's no receipt and no approval
 *  step. In place of a receipt, recording requires ticking a
 *  vendor-checked box: a deliberate speed bump so a number only gets
 *  posted after someone's actually checked with the vendor, not typed
 *  from a guess. */
export default function FutureCostsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: estimates, loading: loadingList } = useAsync(
    () => api.volunteer.futureCostsList(idToken as string),
    [idToken, refreshKey]
  );

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [vendorChecked, setVendorChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editVendorChecked, setEditVendorChecked] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit(e: FutureCost) {
    setEditingId(e.estimate_id);
    setEditDate(toDateInputValue(e.date));
    setEditAmount(String(e.amount));
    setEditPurpose(e.purpose);
    setEditVendorChecked(false);
    setEditError(null);
  }

  async function saveEdit(estimateId: string) {
    setEditError(null);
    const amountNum = Number(editAmount);
    if (!(amountNum > 0)) {
      setEditError("Enter an amount greater than 0.");
      return;
    }
    if (!editPurpose.trim()) {
      setEditError("What's this cost for?");
      return;
    }
    if (!editVendorChecked) {
      setEditError("Confirm you've checked with the vendor before saving.");
      return;
    }
    setSavingEdit(true);
    try {
      await api.volunteer.updateFutureCost(idToken as string, estimateId, {
        date: editDate,
        amount: amountNum,
        purpose: editPurpose.trim(),
        vendorChecked: editVendorChecked,
      });
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setEditError(err instanceof ApiClientError ? err.message : "Could not update this estimate.");
    } finally {
      setSavingEdit(false);
    }
  }

  const { data: festivalInfo } = useAsync(() => api.festival.get(), [refreshKey]);
  const closed = festivalInfo?.future_costs_closed === "true";

  const openEstimates = (estimates ?? []).filter((e) => e.status === "OPEN");
  const movedEstimates = (estimates ?? []).filter((e) => e.status === "MOVED");
  const discardedEstimates = (estimates ?? []).filter((e) => e.status === "DISCARDED");
  const unfinishedDrafts = movedEstimates.filter((e) => e.expense?.status === "DRAFT");
  const total = openEstimates.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [discardReason, setDiscardReason] = useState("");
  const [togglingClosed, setTogglingClosed] = useState(false);

  async function handleMove(e: FutureCost) {
    if (
      !window.confirm(
        "Move this estimate to Expenses? It becomes a draft you can edit to the actual cost before submitting it for approval."
      )
    ) {
      return;
    }
    setActionError(null);
    setActioningId(e.estimate_id);
    try {
      await api.volunteer.moveFutureCost(idToken as string, e.estimate_id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not move this estimate.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDiscard(e: FutureCost) {
    if (!discardReason.trim()) {
      setActionError("Enter a reason for discarding this estimate.");
      return;
    }
    setActionError(null);
    setActioningId(e.estimate_id);
    try {
      await api.volunteer.discardFutureCost(idToken as string, e.estimate_id, discardReason.trim());
      setDiscardingId(null);
      setDiscardReason("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not discard this estimate.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleToggleClosed() {
    const closing = !closed;
    if (closing && !window.confirm("Close future costs? No new estimates can be added. You can reopen this later.")) return;
    setActionError(null);
    setTogglingClosed(true);
    try {
      await api.volunteer.setFutureCostsClosed(idToken as string, closing);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not change future costs status.");
    } finally {
      setTogglingClosed(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!purpose.trim()) {
      setError("What's this cost for?");
      return;
    }
    if (!vendorChecked) {
      setError("Confirm you've checked with the vendor before recording this.");
      return;
    }

    setSubmitting(true);
    try {
      await api.volunteer.recordFutureCost(idToken as string, {
        date,
        amount: amountNum,
        purpose: purpose.trim(),
        vendorChecked,
      });
      setAmount("");
      setPurpose("");
      setVendorChecked(false);
      setSaved(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not record this estimate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Future Costs"
        subtitle="Estimated spend not yet incurred — shows as Projected Balance on the Dashboard"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      {closed && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          Future costs are closed. Everything has been moved to Expenses.
        </p>
      )}

      {!closed && (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Expected Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Estimated Amount</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 25000"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Purpose</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Caterer — Community Dinner"
            className="w-full rounded-lg border border-border bg-card px-3 py-3 text-sm"
          />
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <input
            type="checkbox"
            checked={vendorChecked}
            onChange={(e) => setVendorChecked(e.target.checked)}
            className="mt-0.5"
          />
          I&apos;ve checked with the vendor and this amount is close to actuals, based on my understanding.
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={submitting || !vendorChecked}
          className="w-full rounded-xl bg-maroon py-4 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Saving…" : "Record Estimate"}
        </button>
      </form>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Open Estimates</h2>
        {loadingList && <LoadingIndicator />}
        {!loadingList && openEstimates.length === 0 && (
          <p className="text-sm text-muted">
            {(estimates ?? []).length === 0 ? "No future costs recorded yet." : "No open estimates."}
          </p>
        )}
        {openEstimates.length > 0 && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {openEstimates.map((e) =>
              editingId === e.estimate_id ? (
                <div key={e.estimate_id} className="px-4 py-3 space-y-2">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(ev) => setEditDate(ev.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={editAmount}
                    onChange={(ev) => setEditAmount(ev.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  <input
                    value={editPurpose}
                    onChange={(ev) => setEditPurpose(ev.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={editVendorChecked}
                      onChange={(ev) => setEditVendorChecked(ev.target.checked)}
                      className="mt-0.5"
                    />
                    I&apos;ve checked with the vendor and this amount is close to actuals.
                  </label>
                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingEdit || !editVendorChecked}
                      onClick={() => saveEdit(e.estimate_id)}
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
                <div key={e.estimate_id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{e.purpose}</p>
                      <p className="text-xs text-muted">{formatEventDate(e.date)}</p>
                    </div>
                    <p className="font-semibold text-maroon">{formatCurrency(Number(e.amount))}</p>
                  </div>
                  {discardingId === e.estimate_id ? (
                    <div className="space-y-2">
                      <input
                        value={discardReason}
                        onChange={(ev) => setDiscardReason(ev.target.value)}
                        placeholder="Why is this no longer needed?"
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actioningId === e.estimate_id}
                          onClick={() => handleDiscard(e)}
                          className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Discard estimate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscardingId(null);
                            setDiscardReason("");
                          }}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button type="button" onClick={() => startEdit(e)} className="text-xs font-semibold text-maroon">
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={actioningId === e.estimate_id}
                        onClick={() => handleMove(e)}
                        className="text-xs font-semibold text-maroon disabled:opacity-60"
                      >
                        {actioningId === e.estimate_id ? "Moving…" : "Move to Expenses"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscardingId(e.estimate_id);
                          setDiscardReason("");
                        }}
                        className="text-xs font-semibold text-red-600"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
            <div className="px-4 py-3 flex items-center justify-between gap-2 bg-background">
              <p className="text-sm font-semibold">Total open estimates</p>
              <p className="font-semibold text-maroon">{formatCurrency(total)}</p>
            </div>
          </div>
        )}
      </section>

      {movedEstimates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Moved to Expenses</h2>
          <p className="text-xs text-muted">
            A draft is editable until you submit it. Once submitted, Finance approves it under Review Expenses, and it
            then counts as Spent.
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {movedEstimates.map((e) => (
              <div key={e.estimate_id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{e.purpose}</p>
                    <p className="text-xs text-muted">{e.expense_id}</p>
                  </div>
                  <StatusBadge
                    label={e.expense?.status ?? "MOVED"}
                    tone={
                      e.expense?.status === "APPROVED"
                        ? "success"
                        : e.expense?.status === "REJECTED"
                          ? "danger"
                          : e.expense?.status === "PENDING"
                            ? "warning"
                            : "info"
                    }
                  />
                </div>
                {e.expense?.status === "DRAFT" ? (
                  <DraftExpenseEditor
                    idToken={idToken as string}
                    estimate={e}
                    onChanged={() => setRefreshKey((k) => k + 1)}
                  />
                ) : (
                  e.expense && <p className="text-xs text-muted">{formatCurrency(Number(e.expense.amount))}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {discardedEstimates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Discarded</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {discardedEstimates.map((e) => (
              <div key={e.estimate_id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">{e.purpose}</p>
                  <p className="text-sm text-muted line-through">{formatCurrency(Number(e.amount))}</p>
                </div>
                {e.closed_note && <p className="text-xs text-muted">{e.closed_note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Close Future Costs</h2>
        <p className="text-xs text-muted">
          {closed
            ? "Future costs are closed. Reopen only if a new estimate is needed."
            : openEstimates.length + unfinishedDrafts.length > 0
              ? `To close, move or discard the ${openEstimates.length} open estimate(s) and submit or return ${unfinishedDrafts.length} draft(s).`
              : "Everything has been moved or discarded. Closing stops new estimates and ends future costs."}
        </p>
        <button
          type="button"
          disabled={togglingClosed || (!closed && openEstimates.length + unfinishedDrafts.length > 0)}
          onClick={handleToggleClosed}
          className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-maroon disabled:opacity-60"
        >
          {togglingClosed ? "Saving…" : closed ? "Reopen future costs" : "Close future costs"}
        </button>
      </section>
    </div>
  );
}
