"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency } from "@/lib/date";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";

const STATUS_TONE: Record<string, BadgeTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
};

/** Finance-only expense review — structured like the Donations page
 *  (stat tiles, Needs Review, a settlement/breakdown view, full recent
 *  list) since it's the same underlying workflow: someone made a claim,
 *  a Finance admin independently confirms it before it counts anywhere
 *  (Decision 4 applies to spending claims too, not just payments). */
export default function ReviewExpensesPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  const { data: expensesData, loading, error } = useAsync(
    () => api.volunteer.expensesList(idToken as string),
    [idToken, refreshKey]
  );
  const { data: settlement, loading: loadingSettlement } = useAsync(
    () => api.volunteer.expensesSettlementSummary(idToken as string),
    [idToken, refreshKey]
  );

  const expenses = expensesData ?? [];
  const pending = expenses.filter((e) => e.status === "PENDING");
  const rejected = expenses.filter((e) => e.status === "REJECTED");
  const totalApproved = expenses
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  async function handleApprove(expenseId: string) {
    setActionError(null);
    setActioning(expenseId);
    try {
      await api.volunteer.approveExpense(idToken as string, expenseId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not approve expense.");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(expenseId: string) {
    setActionError(null);
    setActioning(expenseId);
    try {
      await api.volunteer.rejectExpense(idToken as string, expenseId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject expense.");
    } finally {
      setActioning(null);
    }
  }

  async function copyUpiId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedFor(id);
      setTimeout(() => setCopiedFor(null), 2000);
    } catch {
      // ignore — clipboard access blocked, nothing to fall back to here
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Review Expenses" subtitle="Approvals and reimbursement" backHref="/volunteer" backLabel="← Dashboard" />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {expensesData && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile value={formatCurrency(totalApproved)} label="Total Approved" />
            <StatTile value={String(expenses.length)} label="Expenses" />
            <StatTile value={String(pending.length)} label="Needs Review" />
            <StatTile value={String(rejected.length)} label="Rejected" />
          </div>

          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Needs Review</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {pending.map((e) => (
                  <div key={e.expense_id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{e.purpose}</p>
                        <p className="text-xs text-muted">
                          {e.date} · {e.spender_name || e.spender_mobile}
                        </p>
                      </div>
                      <p className="font-semibold text-maroon shrink-0">{formatCurrency(Number(e.amount))}</p>
                    </div>
                    {e.screenshot_url && (
                      <a
                        href={e.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-semibold text-maroon"
                      >
                        View Receipt
                      </a>
                    )}
                    <div className="flex gap-2">
                      <button
                        disabled={actioning === e.expense_id}
                        onClick={() => handleApprove(e.expense_id)}
                        className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actioning === e.expense_id}
                        onClick={() => handleReject(e.expense_id)}
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

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Reimbursement Summary</h2>
            <p className="text-xs text-muted">Total owed to each volunteer, so they can be settled in one go.</p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {loadingSettlement && <p className="px-4 py-3 text-sm text-muted">Loading…</p>}
              {!loadingSettlement && settlement?.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">Nothing to settle yet.</p>
              )}
              {settlement?.map((s) => (
                <div key={s.spenderMobile} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{s.spenderName || s.spenderMobile}</p>
                    <p className="text-xs text-muted">
                      {s.spenderMobile} · {s.count} expense{s.count === 1 ? "" : "s"}
                      {s.upiId ? ` · ${s.upiId}` : " · no UPI ID on file"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-semibold text-maroon">{formatCurrency(s.total)}</p>
                    {s.upiId && (
                      <button
                        type="button"
                        onClick={() => copyUpiId(s.upiId)}
                        className="text-xs font-semibold text-maroon underline"
                      >
                        {copiedFor === s.upiId ? "Copied ✓" : "Copy UPI"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Recent Expenses</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {expenses.length === 0 && <p className="px-4 py-3 text-sm text-muted">No expenses recorded yet.</p>}
              {expenses.map((e) => (
                <div key={e.expense_id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{e.purpose}</p>
                    <p className="text-xs text-muted">
                      {e.date} · {e.spender_name || e.spender_mobile}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-maroon">{formatCurrency(Number(e.amount))}</p>
                    {e.screenshot_url && (
                      <a
                        href={e.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-maroon underline"
                      >
                        Receipt
                      </a>
                    )}
                    <StatusBadge label={e.status} tone={STATUS_TONE[e.status] ?? "neutral"} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
