"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/date";
import type { Expense } from "@/lib/types";

/** Deletes an unpaid expense, with a reason. The row is kept as cancelled
 *  (see deleteExpense on the backend), never erased. Paid expenses show
 *  no delete option. */
export default function DeleteExpense({
  idToken,
  expense,
  onDeleted,
}: {
  idToken: string;
  expense: Expense;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (expense.payment_status === "PAID") return null;

  async function confirmDelete() {
    if (!reason.trim()) {
      setError("Enter a reason for deleting this expense.");
      return;
    }
    if (
      expense.status === "APPROVED" &&
      !window.confirm(
        `This expense is approved and counts as Spent. Deleting it removes ${formatCurrency(Number(expense.amount))} from Spent and from the reimbursement summary. Continue?`
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.volunteer.deleteExpense(idToken, expense.expense_id, reason.trim());
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete this expense.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-red-600">
        Delete
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for deleting (e.g. duplicate)"
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={confirmDelete}
          className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Delete this expense"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
