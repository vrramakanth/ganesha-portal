"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useVolunteerAuth } from "@/lib/VolunteerAuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import type { DinnerToken } from "@/lib/types";

export default function DinnerCounterPage() {
  const { idToken } = useVolunteerAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState<DinnerToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(tokenId: string) {
    setError(null);
    setBusy(true);
    try {
      const t = await api.dinner.token(tokenId.trim());
      setToken(t);
    } catch (err) {
      setToken(null);
      setError(err instanceof ApiClientError ? err.message : "Token not found.");
    } finally {
      setBusy(false);
    }
  }

  async function serve(quantity: number) {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await api.volunteer.dinnerRedeem(idToken as string, token.tokenId, quantity);
      await lookup(token.tokenId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not serve.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <PageHeader title="Dinner Counter" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (tokenInput) lookup(tokenInput);
        }}
        className="flex gap-2"
      >
        <input
          required
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Token ID (e.g. GW-D1-0342)"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-maroon px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {token && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <StatusBadge
            label={token.remaining > 0 ? "VALID TOKEN" : "ALREADY REDEEMED"}
            tone={token.remaining > 0 ? "success" : "neutral"}
          />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-base">
              {token.block} · {token.flatNumber}
            </p>
            <p className="text-muted">
              Allocated: {token.allocated} · Served: {token.served} · Remaining: {token.remaining}
            </p>
          </div>
          {token.remaining > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={busy}
                onClick={() => serve(1)}
                className="rounded-lg bg-maroon py-2.5 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
              >
                Serve 1
              </button>
              <button
                disabled={busy || token.remaining < 2}
                onClick={() => serve(2)}
                className="rounded-lg bg-maroon py-2.5 text-xs font-semibold text-white disabled:opacity-60 active:bg-maroon-dark transition-colors"
              >
                Serve 2
              </button>
              <button
                disabled={busy}
                onClick={() => serve(token.remaining)}
                className="rounded-lg border border-border py-2.5 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                Serve All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
