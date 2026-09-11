"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, ApiClientError } from "./api";
import { disableGoogleAutoSelect } from "./googleIdentity";
import type { Volunteer } from "./types";

const STORAGE_KEY = "gwg_volunteer_id_token";
const CACHE_KEY = "gwg_volunteer_cache";
// Long enough that an admin working through the festival across many
// page loads doesn't pay a fresh ~2s auth round trip on each one; short
// enough that a revoked admin is fully re-verified soon after. Every
// authenticated backend call still independently re-verifies the real
// token regardless of this window, so trusting a recent check here is a
// UI-latency decision, not a security one.
const TRUST_WINDOW_MS = 10 * 60 * 1000;

type Status = "checking" | "signed-out" | "signed-in";

type VolunteerAuthValue = {
  status: Status;
  volunteer: Volunteer | null;
  idToken: string | null;
  error: string | null;
  handleCredential: (idToken: string) => void;
  signOut: () => void;
};

const VolunteerAuthContext = createContext<VolunteerAuthValue | null>(null);

type CachedVerification = { token: string; volunteer: Volunteer; verifiedAt: number };

function readTrustedCache(token: string): Volunteer | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedVerification;
    if (parsed.token !== token) return null;
    if (Date.now() - parsed.verifiedAt > TRUST_WINDOW_MS) return null;
    return parsed.volunteer;
  } catch {
    return null;
  }
}

function writeTrustedCache(token: string, volunteer: Volunteer) {
  const entry: CachedVerification = { token, volunteer, verifiedAt: Date.now() };
  window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
}

export function VolunteerAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clearSession() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(CACHE_KEY);
    setVolunteer(null);
    setIdToken(null);
    setStatus("signed-out");
  }

  /** background=true is the trusted-cache path's quiet re-check: it must
   *  never flash "Checking sign-in…" over an already-rendered admin
   *  screen, and a network hiccup shouldn't sign someone out — only an
   *  explicit token rejection (401) should. */
  async function verify(token: string, { background = false } = {}) {
    if (!background) {
      setStatus("checking");
      setError(null);
    }
    try {
      const v = await api.volunteer.authCheck(token);
      setVolunteer(v);
      setIdToken(token);
      setStatus("signed-in");
      window.sessionStorage.setItem(STORAGE_KEY, token);
      writeTrustedCache(token, v);
    } catch (err) {
      if (background && !(err instanceof ApiClientError && err.status === 401)) {
        return;
      }
      clearSession();
      // A missing/expired token on first load is expected, not an error to surface.
      if (err instanceof ApiClientError && err.status !== 401) {
        setError(err.message);
      }
    }
  }

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("signed-out");
      return;
    }
    const cached = readTrustedCache(stored);
    if (cached) {
      // Render immediately from the recently-verified identity instead
      // of making every page load in this session pay for a fresh round
      // trip, then quietly confirm it's still valid in the background.
      setVolunteer(cached);
      setIdToken(stored);
      setStatus("signed-in");
      verify(stored, { background: true });
    } else {
      verify(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCredential(token: string) {
    verify(token);
  }

  function signOut() {
    disableGoogleAutoSelect();
    clearSession();
  }

  return (
    <VolunteerAuthContext.Provider value={{ status, volunteer, idToken, error, handleCredential, signOut }}>
      {children}
    </VolunteerAuthContext.Provider>
  );
}

export function useVolunteerAuth() {
  const ctx = useContext(VolunteerAuthContext);
  if (!ctx) throw new Error("useVolunteerAuth must be used within VolunteerAuthProvider");
  return ctx;
}
