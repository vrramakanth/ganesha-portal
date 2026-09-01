/** The only two areas currently open for volunteer sign-up (kept in one
 *  place so the sign-up form and the admin roster can't drift). */
export const VOLUNTEER_AREAS = [
  { label: "Decorate Idol/Pooja/Aarti", note: "Expected time: 45 mins" },
  { label: "Bhog/Prasadam/Food", note: null as string | null },
];

export type VolunteerSignup = { area: string; dates: string[]; sessions: string[] };

/** Parses the "availability" string the sign-up form writes, e.g.
 *  "Bhog/Prasadam/Food: 14 Sept, 15 Sept (Morning, Evening); Decorate Idol/Pooja/Aarti: 16 Sept (Evening)"
 *  back into structured picks. Segments that don't match (older
 *  free-text availability from before this format existed) are simply
 *  skipped rather than thrown away — see the "not specified" fallback
 *  where callers use this. */
export function parseVolunteerAvailability(availability: string): VolunteerSignup[] {
  if (!availability) return [];
  return availability
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?):\s*(.+?)\s*\(([^)]+)\)$/);
      if (!match) return null;
      const [, area, datesStr, sessionsStr] = match;
      return {
        area: area.trim(),
        dates: datesStr.split(",").map((d) => d.trim()).filter(Boolean),
        sessions: sessionsStr.split(",").map((s) => s.trim()).filter(Boolean),
      };
    })
    .filter((s): s is VolunteerSignup => s !== null);
}

/** Whether this specific area of a volunteer's application has been
 *  approved — not the same as their overall status, since someone who
 *  applied for two areas can be approved for one and still pending on
 *  the other. Rows approved before per-area tracking existed have no
 *  "approved_areas" value, so an already-ACTIVE row with nothing there
 *  falls back to "every area they applied for". Shared by the admin
 *  roster and the resident's own My Stuff status so they can't drift. */
export function isAreaApproved(v: { areas: string; approved_areas?: string; status: string }, area: string): boolean {
  const applied = String(v.areas || "").split(",").map((a) => a.trim()).filter(Boolean);
  if (!applied.includes(area)) return false;
  const approved = String(v.approved_areas ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  if (approved.length > 0) return approved.includes(area);
  return v.status === "ACTIVE";
}
