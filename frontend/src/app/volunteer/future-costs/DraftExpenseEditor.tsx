"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { fileToBase64 } from "@/lib/file";
import { toDateInputValue } from "@/lib/date";
import type { FutureCost } from "@/lib/types";
import MobileInput from "@/components/MobileInput";

const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm";

/** The draft an estimate becomes when it is moved to Expenses. It starts
 *  from the estimate's numbers and can be edited freely (a tip, a
 *  negotiated discount) until it is submitted to Finance. */
export default function DraftExpenseEditor({
  idToken,
  estimate,
  onChanged,
}: {
  idToken: string;
  estimate: FutureCost;
  onChanged: () => void;
}) {
  const draft = estimate.expense!;
  const [date, setDate] = useState(draft.date ? toDateInputValue(draft.date) : "");
  const [amount, setAmount] = useState(String(draft.amount));
  const [purpose, setPurpose] = useState(draft.purpose);
  const [spenderName, setSpenderName] = useState(draft.spender_name ?? "");
  const [spenderMobile, setSpenderMobile] = useState(draft.spender_mobile ? String(draft.spender_mobile) : "");
  const [upiId, setUpiId] = useState(draft.upi_id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | "return" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const amountNum = Number(amount);
    if (!(amountNum > 0)) throw new Error("Enter an amount greater than 0.");
    if (!purpose.trim()) throw new Error("What is this expense for?");
    if (spenderMobile && !/^[6-9]\d{9}$/.test(spenderMobile)) throw new Error("Enter a valid 10-digit mobile number.");
    await api.volunteer.updateDraftExpense(idToken, draft.expense_id, {
      date,
      amount: amountNum,
      purpose: purpose.trim(),
      spenderName: spenderName.trim() || undefined,
      spenderMobile: spenderMobile || undefined,
      upiId: upiId.trim() || undefined,
      screenshot: file ? await fileToBase64(file) : undefined,
      mimeType: file?.type,
    });
  }

  async function run(kind: "save" | "submit" | "return") {
    setError(null);
    setBusy(kind);
    try {
      if (kind === "return") {
        await api.volunteer.returnFutureCostDraft(idToken, estimate.estimate_id);
      } else {
        await save();
        if (kind === "submit") {
          if (!spenderMobile) throw new Error("Add who spent this (a 10-digit mobile number) before submitting.");
          await api.volunteer.submitDraftExpense(idToken, draft.expense_id);
        }
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Estimated ₹{Number(estimate.amount).toLocaleString("en-IN")}. Change the amount to the actual cost (a tip, a
        negotiated discount), then submit for approval.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Actual amount"
          className={inputClass}
        />
      </div>
      <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose" className={inputClass} />
      <input
        value={spenderName}
        onChange={(e) => setSpenderName(e.target.value)}
        placeholder="Who spent it (name)"
        className={inputClass}
      />
      <MobileInput value={spenderMobile} onChange={setSpenderMobile} required={false} />
      <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID (optional)" className={inputClass} />
      <div className="space-y-1">
        <label className="text-xs font-medium">Receipt (optional)</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        {draft.screenshot_url && !file && (
          <a href={draft.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-maroon">
            View saved receipt
          </a>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("save")}
          className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-maroon disabled:opacity-60"
        >
          {busy === "save" ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("submit")}
          className="flex-1 rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy === "submit" ? "Submitting…" : "Save & submit"}
        </button>
      </div>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => {
          if (window.confirm("Return this to a future-cost estimate? The draft expense will be discarded.")) run("return");
        }}
        className="text-xs font-semibold text-muted underline disabled:opacity-60"
      >
        {busy === "return" ? "Returning…" : "Return to estimates"}
      </button>
    </div>
  );
}
