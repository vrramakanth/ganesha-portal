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
