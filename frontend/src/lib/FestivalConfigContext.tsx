"use client";

/** Fetches `festival.get` once for the whole app instead of every page
 *  independently calling `useAsync(() => api.festival.get())` — this used
 *  to be duplicated across 14 pages. Also the one place that turns the
 *  raw `FestivalInfo` into the two things most call sites actually want:
 *  `modules` (the Namma Habba module registry, backend/Modules.js) for
 *  building nav/pages, and `communityName` as a convenient shorthand. */

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { EnabledModules, FestivalInfo } from "./types";

const DEFAULT_MODULES: EnabledModules = {
  donations: true,
  sponsorships: true,
  events: true,
  meal: true,
  guests: false,
  volunteers: true,
  expenses: true,
};

type FestivalConfigValue = {
  festival: FestivalInfo | null;
  modules: EnabledModules;
  communityName: string;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const FestivalConfigContext = createContext<FestivalConfigValue | null>(null);

export function FestivalConfigProvider({ children }: { children: React.ReactNode }) {
  const [festival, setFestival] = useState<FestivalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .festival.get()
      .then((data) => {
        if (!cancelled) {
          setFestival(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const value: FestivalConfigValue = {
    festival,
    modules: festival?.modules ?? DEFAULT_MODULES,
    communityName: festival?.community_name || "Brigade Woods",
    loading,
    error,
    refresh: () => setNonce((n) => n + 1),
  };

  return <FestivalConfigContext.Provider value={value}>{children}</FestivalConfigContext.Provider>;
}

export function useFestivalConfig() {
  const ctx = useContext(FestivalConfigContext);
  if (!ctx) throw new Error("useFestivalConfig must be used within FestivalConfigProvider");
  return ctx;
}
