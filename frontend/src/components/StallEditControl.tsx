"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { parsePayment, parseStallNeeds } from "@/lib/stallNeeds";
import type { EventRegistration } from "@/lib/types";

const STALL_TYPES = ["Food & snacks", "Drinks", "Games", "Art & crafts", "Toys & books", "Something else"];

/** For an organiser: fill in or fix a stall's details (type, idea, kids,
 *  tables, chairs, power, other needs), e.g. when a parent's details were lost
 *  or they phoned in a change. The amount due follows the tables until a
 *  payment is verified. */
export default function StallEditControl({
  registration: r,
  idToken,
  feePerTable,
  onSaved,
}: {
  registration: EventRegistration;
  idToken: string;
  feePerTable: number;
  onSaved: () => void;
}) {
  const needs = parseStallNeeds(r.comments);
  const payment = parsePayment(r.comments);
  const [type, setType] = useState(r.sub_category || STALL_TYPES[0]);
  const [idea, setIdea] = useState(needs?.idea ?? "");
  const [kids, setKids] = useState(String(needs?.kids || 1));
  const [tables, setTables] = useState(String(needs?.tables ?? 1));
  const [chairs, setChairs] = useState(String(needs?.chairs ?? 2));
  const [power, setPower] = useState(needs?.power ?? false);
  const [powerDetails, setPowerDetails] = useState(needs?.powerDetails ?? "");
  const [other, setOther] = useState(needs?.other ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api.volunteer.updateStallDetails(idToken, r.registration_id, {
        stallType: type,
        idea,
        kids: Number(kids) || 0,
        tables: Number(tables) || 0,
        chairs: Number(chairs) || 0,
        power,
        powerDetails,
        other,
        fee: payment.verified ? undefined : (Number(tables) || 0) * feePerTable,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the stall details.");
    } finally {
      setBusy(false);
    }
  }

  const field = "rounded-lg border border-border bg-card px-3 py-2 text-xs";
  return (
    <details className="mt-2 rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-xs font-semibold">{needs ? "Edit stall details" : "Add stall details"}</summary>
      <div className="mt-2 space-y-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${field} w-full`}>
          {STALL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="What will the stall be?" className={`${field} w-full`} />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[11px] text-muted">
            Kids
            <input value={kids} onChange={(e) => setKids(digits(e.target.value))} inputMode="numeric" className={`${field} mt-0.5 w-full`} />
          </label>
          <label className="text-[11px] text-muted">
            Tables
            <input value={tables} onChange={(e) => setTables(digits(e.target.value))} inputMode="numeric" className={`${field} mt-0.5 w-full`} />
          </label>
          <label className="text-[11px] text-muted">
            Chairs
            <input value={chairs} onChange={(e) => setChairs(digits(e.target.value))} inputMode="numeric" className={`${field} mt-0.5 w-full`} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={power} onChange={(e) => setPower(e.target.checked)} />
          Needs a power point
        </label>
        {power && (
          <input value={powerDetails} onChange={(e) => setPowerDetails(e.target.value)} placeholder="What for?" className={`${field} w-full`} />
        )}
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Anything else needed (optional)" className={`${field} w-full`} />
        {!payment.verified && (
          <p className="text-[11px] text-muted">Amount due will be set to ₹{(Number(tables) || 0) * feePerTable} ({tables || 0} × ₹{feePerTable}).</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy || !idea.trim()}
          onClick={save}
          className="w-full rounded-lg bg-maroon py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save stall details"}
        </button>
      </div>
    </details>
  );
}
