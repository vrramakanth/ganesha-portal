import type { EventRegistration } from "./types";

/** One event's sign-up numbers, for the organisers' summary page. Pure so it
 *  can be tested without the page: it only reads registrations that already
 *  load for the Nominations screen. */
export type EventLike = { event_id: string; name: string; date: string; category: string; status: string };

export type DayCount = { day: string; count: number };

export type EventSummaryRow = {
  event: EventLike;
  /** Everyone who signed up, cancelled and rejected included. */
  signups: number;
  confirmed: number;
  pending: number;
  rejected: number;
  cancelled: number;
  checkedIn: number;
  /** Distinct homes (block + flat), counting sign-ups that aren't cancelled or rejected. */
  homes: number;
  /** Distinct people, same rule (by resident id, else mobile). */
  people: number;
  /** Of those people, how many also signed up for another event. */
  returning: number;
  /** Sign-ups per calendar day (India time), oldest first. */
  byDay: DayCount[];
  /** Share of sign-ups made in the last 2 days before the event, 0–100; null when the dates aren't usable. */
  lastTwoDaysPct: number | null;
  topBlocks: { block: string; count: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-09" for a date in India time, or null if it isn't a date. */
export function dayKey(value: string | Date | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function dayNumber(key: string): number {
  return Math.round(new Date(`${key}T00:00:00Z`).getTime() / DAY_MS);
}

const counts = (r: EventRegistration) => r.status !== "CANCELLED" && r.status !== "REJECTED";
const personKey = (r: EventRegistration) => (r.resident_id || r.mobile || r.registration_id).toString();

export function summariseEvents(events: EventLike[], registrations: EventRegistration[]): EventSummaryRow[] {
  // Which events each person is in, to count the ones who come back.
  const eventsByPerson = new Map<string, Set<string>>();
  registrations.filter(counts).forEach((r) => {
    const set = eventsByPerson.get(personKey(r)) ?? new Set<string>();
    set.add(r.event_id);
    eventsByPerson.set(personKey(r), set);
  });

  return events.map((event) => {
    const regs = registrations.filter((r) => r.event_id === event.event_id);
    const live = regs.filter(counts);
    const people = new Set(live.map(personKey));
    const homes = new Set(live.map((r) => `${r.block}-${r.flat_number}`.toUpperCase()));
    const days = new Map<string, number>();
    regs.forEach((r) => {
      const key = dayKey(r.created_at);
      if (key) days.set(key, (days.get(key) ?? 0) + 1);
    });
    const byDay = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));

    const eventDay = dayKey(event.date);
    let lastTwoDaysPct: number | null = null;
    if (eventDay && byDay.length) {
      const total = byDay.reduce((n, d) => n + d.count, 0);
      const late = byDay.filter((d) => dayNumber(eventDay) - dayNumber(d.day) <= 2).reduce((n, d) => n + d.count, 0);
      lastTwoDaysPct = Math.round((late / total) * 100);
    }

    const blocks = new Map<string, number>();
    live.forEach((r) => blocks.set(r.block || "?", (blocks.get(r.block || "?") ?? 0) + 1));

    return {
      event,
      signups: regs.length,
      confirmed: regs.filter((r) => r.status === "CONFIRMED").length,
      pending: regs.filter((r) => r.status === "PENDING_REVIEW").length,
      rejected: regs.filter((r) => r.status === "REJECTED").length,
      cancelled: regs.filter((r) => r.status === "CANCELLED").length,
      checkedIn: regs.filter((r) => Boolean(r.check_in_at)).length,
      homes: homes.size,
      people: people.size,
      returning: [...people].filter((p) => (eventsByPerson.get(p)?.size ?? 0) > 1).length,
      byDay,
      lastTwoDaysPct,
      topBlocks: [...blocks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([block, count]) => ({ block, count })),
    };
  });
}

/** Totals across every event: people counted once however many events they joined. */
export function overallTotals(registrations: EventRegistration[]) {
  const live = registrations.filter(counts);
  const eventsByPerson = new Map<string, Set<string>>();
  live.forEach((r) => {
    const set = eventsByPerson.get(personKey(r)) ?? new Set<string>();
    set.add(r.event_id);
    eventsByPerson.set(personKey(r), set);
  });
  return {
    signups: live.length,
    people: eventsByPerson.size,
    multiEvent: [...eventsByPerson.values()].filter((s) => s.size > 1).length,
    homes: new Set(live.map((r) => `${r.block}-${r.flat_number}`.toUpperCase())).size,
  };
}
