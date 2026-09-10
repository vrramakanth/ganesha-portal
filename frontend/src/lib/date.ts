export function formatEventWhen(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** A plain "18 Sep 2026". Forced to Asia/Kolkata rather than the
 *  viewer's own device timezone, since this app is Brigade-Woods-only
 *  regardless of where someone happens to be checking it from. */
export function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Time-only cells (start_time/end_time) round-trip through Sheets on
 *  its classic Dec-30-1899 epoch date. The IANA tz database's
 *  Asia/Kolkata offset for 1899 is the pre-1906 historical +5:21:10
 *  ("Madras local mean time"), not the modern +5:30 — so naively
 *  reading UTC hours/minutes (or converting with today's +5:30 by
 *  hand) is off by ~9 minutes. Letting Intl apply Asia/Kolkata's own
 *  (historically correct) rule for that literal date reverses the
 *  exact same quirk Apps Script applied when writing it, and matches
 *  what Sheets itself displays for the cell. */
export function formatEventTime(timeStr: string): string {
  // en-IN renders am/pm lowercase; uppercase for a cleaner look (a
  // no-op on the digits/colon, so safe to apply to the whole string).
  return new Date(timeStr)
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .toUpperCase();
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses the festival's "dates" config (e.g. "14-20 Sep 2026") into
 *  individual selectable days. Returns [] if the string doesn't match
 *  that format — callers should handle an empty list gracefully. */
export function parseFestivalDateRange(dates: string): { iso: string; label: string }[] {
  const match = dates.trim().match(/^(\d{1,2})-(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return [];
  const [, startDay, endDay, monthName, year] = match;
  const month = MONTH_INDEX[monthName.slice(0, 3).toLowerCase()];
  if (month === undefined) return [];

  const days: { iso: string; label: string }[] = [];
  for (let day = Number(startDay); day <= Number(endDay); day++) {
    const date = new Date(Number(year), month, day);
    days.push({
      iso: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    });
  }
  return days;
}
