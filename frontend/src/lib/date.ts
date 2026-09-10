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

/** A plain "18 Sep 2026" — same local-timezone conversion as
 *  formatEventWhen above (not forced to UTC), since a date-only value
 *  round-trips through Sheets as midnight in the spreadsheet's own
 *  timezone, not UTC. */
export function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Time-only cells (start_time/end_time) come back as a Date on Sheets'
 *  classic Dec-30-1899 epoch, with the wall-clock hour/minute encoded
 *  directly in the UTC fields — Apps Script doesn't apply the
 *  spreadsheet's timezone to a pure time-of-day value the way it does
 *  for a real date. Reading local hours/minutes here would drift by
 *  the browser's UTC offset, so this reads UTC fields on purpose. */
export function formatEventTime(timeStr: string): string {
  const d = new Date(timeStr);
  const hours24 = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours = hours24 % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
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
