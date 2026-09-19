import type { CounterMap } from "@/lib/dinnerCounters";
import type { CommunityDinnerRegistration } from "@/lib/types";

export type Household = {
  key: string;
  block: string;
  flat: number;
  name: string;
  members: number;
  confirmed: boolean;
  late: boolean;
  counter: number;
};

export function parseMap(raw: string | undefined): CounterMap {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const heads = (r: CommunityDinnerRegistration) => r.adults + r.children + r.guest_adults + r.guest_children;

/** One line per flat: registrations sharing a block and flat (flats compared
 *  as numbers, since the sheet drops leading zeros) are one household, taken
 *  at the largest member count. A late registration only counts as late when
 *  the flat has no earlier one. */
export function buildHouseholds(registrations: CommunityDinnerRegistration[], map: CounterMap): Household[] {
  const groups: Record<string, CommunityDinnerRegistration[]> = {};
  registrations
    .filter((r) => r.status !== "CANCELLED" && r.status !== "REJECTED")
    .forEach((r) => {
      const key = `${String(r.block).trim().toUpperCase()}-${Number(r.flat_number)}`;
      (groups[key] ??= []).push(r);
    });

  return Object.entries(groups).map(([key, rows]) => {
    const regular = rows.filter((r) => !r.counter_override);
    const pool = regular.length > 0 ? regular : rows;
    const chosen = pool.reduce((best, r) => (heads(r) > heads(best) ? r : best));
    const block = String(chosen.block).trim().toUpperCase();
    return {
      key,
      block,
      flat: Number(chosen.flat_number),
      name: chosen.resident_name,
      members: heads(chosen),
      confirmed: chosen.status === "CONFIRMED",
      late: regular.length === 0,
      counter: chosen.counter_override ? Number(chosen.counter_override) : map[block] ?? 0,
    };
  });
}

