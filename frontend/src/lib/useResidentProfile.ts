"use client";

import { useEffect, useState } from "react";

export type ResidentProfile = {
  name: string;
  mobile: string;
  block: string;
  flatNumber: string;
};

const STORAGE_KEY = "gwg_resident_profile";
const EMPTY: ResidentProfile = { name: "", mobile: "", block: "", flatNumber: "" };

/** Persists the resident's own details in this browser only (spec §6:
 *  don't ask for the same information repeatedly). Not a security
 *  mechanism — the backend never trusts this without server-side
 *  validation of its own. */
export function useResidentProfile() {
  const [profile, setProfile] = useState<ResidentProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // One-time hydration from localStorage on mount — there is no
      // external subscription to attach to, just a synchronous read.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setProfile(JSON.parse(raw));
    } catch {
      // ignore — private browsing / storage blocked
    } finally {
      setLoaded(true);
    }
  }, []);

  const save = (next: ResidentProfile) => {
    setProfile(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore — private browsing / storage blocked
    }
  };

  return { profile, saveProfile: save, loaded };
}
