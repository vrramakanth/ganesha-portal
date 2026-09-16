"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import { formatCurrency, formatEventDate } from "@/lib/date";
import MobileInput from "@/components/MobileInput";
import PageHeader from "@/components/PageHeader";
import LoadingIndicator from "@/components/LoadingIndicator";

const BHOG_DATE_MIN = "2026-09-14";
const BHOG_DATE_MAX = "2026-09-20";

/** Open to any signed-in admin, same as recording an Expense — this is
 *  a coordination log for who's sponsoring which evening's Maha
 *  Prasadam, not a payment review queue. The amount always traces back
 *  to an existing verified donation (picked by the admin when there's
 *  more than one) rather than being typed fresh, so it never
 *  double-counts against the Festival Summary — unless no matching
 *  donation exists at all (a sponsor who paid outside the app), in
 *  which case it falls back to a manual, unlinked amount. */
export default function BhogSponsorsPage() {
  const { idToken } = useVolunteerAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: sponsors, loading: loadingList } = useAsync(
    () => api.volunteer.bhogSponsorsList(idToken as string),
    [idToken, refreshKey]
  );

  const [mobile, setMobile] = useState("");
  const [residentName, setResidentName] = useState("");
  const [donations, setDonations] = useState<{ transactionId: string; amount: number; createdAt: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [bhogDate, setBhogDate] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setLookupMessage("Enter a valid 10-digit mobile number first.");
      return;
    }
    setLookingUp(true);
    setLookupMessage(null);
    try {
      const result = await api.volunteer.lookupBhogSponsorDonations(idToken as string, mobile);
      setResidentName(result.name);
      setDonations(result.donations);
      if (result.donations.length === 1) {
        const only = new Set([result.donations[0].transactionId]);
        setSelectedIds(only);
        setAmount(String(result.donations[0].amount));
        setLookupMessage(null);
      } else if (result.donations.length > 1) {
        setSelectedIds(new Set());
        setAmount("");
        setLookupMessage("Multiple donations found — select every one this sponsorship is made up of below.");
      } else {
        setSelectedIds(new Set());
        setAmount("");
        setLookupMessage("No matching donation found — enter the amount manually.");
      }
    } catch (err) {
      setLookupMessage(err instanceof ApiClientError ? err.message : "Could not look up this number.");
    } finally {
      setLookingUp(false);
    }
  }

  function toggleDonation(d: { transactionId: string; amount: number }) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(d.transactionId)) next.delete(d.transactionId);
      else next.add(d.transactionId);
      const total = donations.filter((x) => next.has(x.transactionId)).reduce((sum, x) => sum + x.amount, 0);
      setAmount(String(total));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!residentName.trim()) {
      setError("Enter the sponsor's name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      setError("Enter a valid sponsorship amount.");
      return;
    }
    if (!bhogDate) {
      setError("Pick which evening this sponsors.");
      return;
    }

    setSubmitting(true);
    try {
      await api.volunteer.recordBhogSponsor(idToken as string, {
        mobile,
        residentName: residentName.trim(),
        transactionIds: Array.from(selectedIds),
        amount: amountNum,
        bhogDate,
      });
      setMobile("");
      setResidentName("");
      setDonations([]);
      setSelectedIds(new Set());
      setAmount("");
      setBhogDate("");
      setLookupMessage(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save this sponsor.");
    } finally {
      setSubmitting(false);
    }
  }

  const byDate = new Map<string, typeof sponsors>();
  (sponsors ?? []).forEach((s) => {
    const list = byDate.get(s.bhog_date) ?? [];
    list.push(s);
    byDate.set(s.bhog_date, list as NonNullable<typeof sponsors>);
  });

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader
        title="Bhog Sponsors"
        subtitle="Who's sponsoring Maha Prasadam, and on which evening (14–20 Sept)"
        backHref="/volunteer"
        backLabel="← Dashboard"
      />

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mobile</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <MobileInput
                value={mobile}
                onChange={(v) => {
                  setMobile(v);
                  setLookupMessage(null);
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookingUp}
              title="Lookup — fetch name and donations"
              aria-label="Lookup — fetch name and donations"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg border border-maroon text-maroon disabled:opacity-50 active:bg-maroon/10 transition-colors"
            >
              {lookingUp ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" strokeLinecap="round" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
          {lookupMessage && <p className="text-xs text-muted">{lookupMessage}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <input
            value={residentName}
            onChange={(e) => setResidentName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
          />
        </div>

        {donations.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Which donation(s)? (select all that apply)</label>
            <div className="space-y-1.5">
              {donations.map((d) => (
                <label
                  key={d.transactionId}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input type="checkbox" checked={selectedIds.has(d.transactionId)} onChange={() => toggleDonation(d)} />
                  {formatCurrency(d.amount)} — {formatEventDate(d.createdAt)}
                </label>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs font-semibold text-maroon">
                Total selected: {formatCurrency(Number(amount) || 0)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Amount</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
          />
          {selectedIds.size > 0 && (
            <p className="text-xs text-muted">Linked to donation{selectedIds.size > 1 ? "s" : ""} {Array.from(selectedIds).join(", ")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Bhog Evening</label>
          <input
            type="date"
            min={BHOG_DATE_MIN}
            max={BHOG_DATE_MAX}
            value={bhogDate}
            onChange={(e) => setBhogDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-maroon py-3.5 text-center text-sm font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
        >
          {submitting ? "Saving…" : "Record Sponsor"}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">All Sponsors</h2>
        {loadingList && <LoadingIndicator />}
        {!loadingList && (sponsors ?? []).length === 0 && (
          <p className="text-sm text-muted">No Bhog sponsors recorded yet.</p>
        )}
        {Array.from(byDate.entries()).map(([date, list]) => (
          <div key={date} className="space-y-2">
            <p className="text-xs font-semibold text-saffron">{formatEventDate(date)}</p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {(list ?? []).map((s) => (
                <div key={s.sponsor_id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{s.resident_name}</p>
                    <p className="text-xs text-muted">{s.mobile}</p>
                  </div>
                  <p className="font-semibold text-maroon">{formatCurrency(Number(s.amount))}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
