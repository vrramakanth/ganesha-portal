"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, ApiClientError } from "./api";
import { disableGoogleAutoSelect } from "./googleIdentity";
import type { Volunteer } from "./types";

const STORAGE_KEY = "gwg_volunteer_id_token";

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

export function VolunteerAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify(token: string) {
    setStatus("checking");
    setError(null);
    try {
      const v = await api.volunteer.authCheck(token);
      setVolunteer(v);
      setIdToken(token);
      setStatus("signed-in");
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } catch (err) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setVolunteer(null);
      setIdToken(null);
      setStatus("signed-out");
      // A missing/expired token on first load is expected, not an error to surface.
      if (err instanceof ApiClientError && err.status !== 401) {
        setError(err.message);
      }
    }
  }

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    // One-time session hydration on mount — there is no external
    // subscription to attach to, just a synchronous sessionStorage read
    // followed by an async verification call.
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      verify(stored);
    } else {
      setStatus("signed-out");
    }
  }, []);

  function handleCredential(token: string) {
    verify(token);
  }

  function signOut() {
    disableGoogleAutoSelect();
    window.sessionStorage.removeItem(STORAGE_KEY);
    setVolunteer(null);
    setIdToken(null);
    setStatus("signed-out");
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
