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

/** The last festival.get result, kept so a repeat visit paints the right
 *  festival (name, colours, modules) straight away instead of waiting a
 *  second or so for Apps Script. A first visit still waits for the fetch. */
const CACHE_KEY = "namma_festival_cache_v1";

/** Nothing is on until the festival's own settings arrive, so a festival
 *  with Donations or Meal off never briefly shows their buttons. */
const NO_MODULES: EnabledModules = {
  donations: false,
  sponsorships: false,
  events: false,
  meal: false,
  guests: false,
  volunteers: false,
  expenses: false,
};

/** Used only if festival.get fails outright and nothing is cached. */
const DEFAULT_MODULES: EnabledModules = {
  donations: true,
  sponsorships: true,
  events: true,
  meal: true,
  guests: false,
  volunteers: true,
  expenses: true,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const PAGE_BACKGROUND = "#fffaf3";
const INK = "#2a1a14";

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A darker shade of a #rrggbb colour, for hover/pressed states. */
function darken(hex: string, factor = 0.8): string {
  return toHex(toRgb(hex).map((c) => c * factor) as Rgb);
}

/** `amount` of `hex` blended into white — a pale tint of the colour. */
function tint(hex: string, amount: number): string {
  return toHex(toRgb(hex).map((c) => 255 - (255 - c) * amount) as Rgb);
}

/** Darkens a colour until it is readable as text on the page background
 *  (a light accent such as yellow is not, as it comes). */
function readableOnPage(hex: string): string {
  let shade = hex;
  for (let i = 0; i < 20 && contrast(shade, PAGE_BACKGROUND) < 4.5; i++) shade = darken(shade, 0.9);
  return shade;
}

/** Overrides the globals.css palette from the festival's configured theme
 *  colours. "primary" drives the maroon tokens, "accent" the saffron ones;
 *  an unset or malformed value leaves the stylesheet default in place.
 *  An accent also tints the page background and borders, and picks a
 *  readable text colour for buttons filled with it. */
function applyTheme(primary: string, accent: string) {
  const root = document.documentElement;
  const set = (name: string, value: string | null) =>
    value ? root.style.setProperty(name, value) : root.style.removeProperty(name);
  const p = HEX_COLOR.test(primary) ? primary : null;
  const a = HEX_COLOR.test(accent) ? accent : null;
  set("--maroon", p);
  set("--maroon-dark", p && darken(p));
  set("--saffron", a);
  const accentText = a && readableOnPage(a);
  set("--saffron-dark", accentText);
  set("--saffron-text", accentText);
  set("--on-saffron", a && (contrast("#ffffff", a) >= contrast(INK, a) ? "#ffffff" : INK));
  set("--background", a && tint(a, 0.08));
  set("--border", a && tint(a, 0.22));
}

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
    // Paint from the last visit's settings while the fresh ones load.
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (cached) setFestival((current) => current ?? (JSON.parse(cached) as FestivalInfo));
    } catch {
      // Storage can be blocked or hold bad JSON; the fetch below still runs.
    }
    setLoading(true);
    api
      .festival.get()
      .then((data) => {
        if (!cancelled) {
          setFestival(data);
          setError(null);
          try {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          } catch {
            // Not worth failing the page over.
          }
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

  useEffect(() => {
    if (!festival) return;
    applyTheme(festival.theme_primary ?? "", festival.theme_accent ?? "");
    if (festival.festival_name) {
      document.title = `${festival.community_name || "Brigade Woods"} | ${festival.festival_name}`;
    }
  }, [festival]);

  const value: FestivalConfigValue = {
    festival,
    modules: festival?.modules ?? (error ? DEFAULT_MODULES : NO_MODULES),
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
