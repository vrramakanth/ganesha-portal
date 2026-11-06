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
/** What one table costs, read from a "Table fee: 150" line in the event's
 *  description so each event can set its own; 150 when there's no such line. */
export const DEFAULT_TABLE_FEE = 150;
export function tableFee(description: string | undefined): number {
  const match = (description ?? "").match(/table\s*fee\D{0,6}(\d+)/i);
  return match ? Number(match[1]) : DEFAULT_TABLE_FEE;
}

export type StallNeeds = {
  idea: string;
  kids: number;
  tables: number;
  chairs: number;
  power: boolean;
  powerDetails: string;
  other: string;
  /** Amount due for the tables, in rupees, and the UPI reference the parent
   *  typed after paying (empty when nothing is due or not yet paid). */
  fee?: number;
  paymentRef?: string;
};

export function buildStallComments(n: StallNeeds): string {
  return [
    `Stall: ${n.idea.trim()}`,
    `Kids at stall: ${n.kids}`,
    `Tables: ${n.tables}`,
    `Chairs: ${n.chairs}`,
    `Power: ${n.power ? `Yes${n.powerDetails.trim() ? `: ${n.powerDetails.trim()}` : ""}` : "No"}`,
    n.other.trim() && `Other needs: ${n.other.trim()}`,
    n.fee ? `Table fee due: ${n.fee}` : "",
    n.fee ? `Payment ref: ${n.paymentRef?.trim() || "none yet"}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function lineValue(comments: string, label: string): string | null {
  const match = comments.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "im"));
  return match ? match[1].trim() : null;
}

/** Null when the registration isn't a stall sign-up (no "Tables:" line). */
export function parseStallNeeds(comments: string | undefined): Required<StallNeeds> | null {
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
    fee: Number(lineValue(comments, "Table fee due")) || 0,
    paymentRef: (lineValue(comments, "Payment ref") ?? "").replace(/^none yet$/i, ""),
  };
}

/** Totals across stall registrations that haven't been rejected. */
export function summariseStalls(registrations: EventRegistration[]) {
  let stalls = 0;
  let tables = 0;
  let chairs = 0;
  let power = 0;
  let kids = 0;
  let feeDue = 0;
  let feePaid = 0;
  registrations.forEach((r) => {
    if (r.status === "REJECTED" || r.status === "CANCELLED") return;
    const needs = parseStallNeeds(r.comments);
    if (!needs) return;
    stalls += 1;
    tables += needs.tables;
    chairs += needs.chairs;
    kids += needs.kids;
    if (needs.power) power += 1;
    feeDue += needs.fee;
    if (needs.fee && needs.paymentRef) feePaid += needs.fee;
  });
  return { stalls, tables, chairs, power, kids, feeDue, feePaid };
}
