import type { EventRegistration } from "./types";

/** A kids' stall registration keeps its logistics in the registration's
 *  comments, one labelled line each, so it needs no extra columns:
 *
 *      Stall: homemade lemonade and cookies
 *      Kids at stall: 2
 *      Tables: 1
 *      Chairs: 2
 *      Power: Yes: for a blender
 *      Other needs: shade
 *
 *  `buildStallComments` writes that text; `parseStallNeeds` reads it back so
 *  volunteers can total tables, chairs and power for the whole event. */
export type StallNeeds = {
  idea: string;
  kids: number;
  tables: number;
  chairs: number;
  power: boolean;
  powerDetails: string;
  other: string;
};

export function buildStallComments(n: StallNeeds): string {
  return [
    `Stall: ${n.idea.trim()}`,
    `Kids at stall: ${n.kids}`,
    `Tables: ${n.tables}`,
    `Chairs: ${n.chairs}`,
    `Power: ${n.power ? `Yes${n.powerDetails.trim() ? `: ${n.powerDetails.trim()}` : ""}` : "No"}`,
    n.other.trim() && `Other needs: ${n.other.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function lineValue(comments: string, label: string): string | null {
  const match = comments.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "im"));
  return match ? match[1].trim() : null;
}

/** Null when the registration isn't a stall sign-up (no "Tables:" line). */
export function parseStallNeeds(comments: string | undefined): Omit<StallNeeds, "kids" | "idea" | "other"> & {
  kids: number;
  idea: string;
  other: string;
} | null {
  if (!comments) return null;
  const tables = lineValue(comments, "Tables");
  if (tables === null) return null;
  const power = lineValue(comments, "Power") ?? "No";
  return {
    idea: lineValue(comments, "Stall") ?? "",
    kids: Number(lineValue(comments, "Kids at stall")) || 0,
    tables: Number(tables) || 0,
    chairs: Number(lineValue(comments, "Chairs")) || 0,
    power: /^yes/i.test(power),
    powerDetails: power.replace(/^yes:?\s*/i, ""),
    other: lineValue(comments, "Other needs") ?? "",
  };
}

/** Totals across stall registrations that haven't been rejected. */
export function summariseStalls(registrations: EventRegistration[]) {
  let stalls = 0;
  let tables = 0;
  let chairs = 0;
  let power = 0;
  let kids = 0;
  registrations.forEach((r) => {
    if (r.status === "REJECTED" || r.status === "CANCELLED") return;
    const needs = parseStallNeeds(r.comments);
    if (!needs) return;
    stalls += 1;
    tables += needs.tables;
    chairs += needs.chairs;
    kids += needs.kids;
    if (needs.power) power += 1;
  });
  return { stalls, tables, chairs, power, kids };
}
