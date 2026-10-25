/** Server-side lookups for the tags and images chat apps use to draw a link
 *  card. They read the same backend the pages do, cached for five minutes,
 *  and return null on any failure so a slow or down backend only costs the
 *  card its details, never the page. */
import { formatEventTime } from "./date";

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 5000;

async function backendGet<T>(action: string): Promise<T | null> {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return null;
  try {
    const res = await fetch(`${api}?action=${action}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json()) as { ok?: boolean; data?: T };
    return body.ok && body.data !== undefined ? body.data : null;
  } catch {
    return null;
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export type FestivalPreview = {
  name: string;
  community: string;
  tagline: string;
  dates: string;
  venue: string;
  primary: string;
  accent: string;
};

const DEFAULT_PRIMARY = "#7a1330";
const DEFAULT_ACCENT = "#f4791f";

export async function festivalPreview(): Promise<FestivalPreview | null> {
  const info = await backendGet<{
    festival_name?: string;
    community_name?: string;
    tagline?: string;
    dates?: string;
    venue?: string;
    theme_primary?: string;
    theme_accent?: string;
  }>("festival.get");
  if (!info?.festival_name) return null;
  return {
    name: info.festival_name,
    community: info.community_name || "Namma Habba",
    tagline: info.tagline ?? "",
    dates: info.dates ?? "",
    venue: info.venue ?? "",
    primary: HEX.test(info.theme_primary ?? "") ? (info.theme_primary as string) : DEFAULT_PRIMARY,
    accent: HEX.test(info.theme_accent ?? "") ? (info.theme_accent as string) : DEFAULT_ACCENT,
  };
}

export type EventPreview = { name: string; when: string; location: string; description: string };

export async function eventPreview(eventId: string): Promise<EventPreview | null> {
  const events = await backendGet<
    { event_id: string; name: string; description: string; date: string; start_time: string; location: string; status: string }[]
  >("events.list");
  const event = events?.find((e) => e.event_id === eventId);
  if (!event) return null;
  // start_time arrives as the sheet's raw time-of-day value
  // ("1899-12-30T03:53:50.000Z"); formatEventTime turns it into "9:15 AM".
  const when = [formatDate(event.date), formatTime(event.start_time)].filter(Boolean).join(" · ");
  const description = [when, event.location].filter(Boolean).join(" · ");
  return { name: event.name, when, location: event.location ?? "", description: description || event.description || "" };
}

function formatDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** "9:15 AM" from the sheet's time value; text that isn't a date (a time
 *  typed in by hand) is shown as written rather than as "Invalid Date". */
function formatTime(value: string): string {
  if (!value) return "";
  return Number.isNaN(new Date(value).getTime()) ? String(value) : formatEventTime(value);
}
