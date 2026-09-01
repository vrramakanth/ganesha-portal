/** The only two areas currently open for volunteer sign-up (kept in one
 *  place so the sign-up form and the admin roster can't drift). */
export const VOLUNTEER_AREAS = [
  { label: "Decorate Idol/Pooja/Aarti", note: "Expected time: 45 mins" },
  { label: "Bhog/Prasadam/Food", note: null as string | null },
];

export type VolunteerSignup = { area: string; dates: string[]; session: string };

/** Parses the "availability" string the sign-up form writes, e.g.
 *  "Bhog/Prasadam/Food: 14 Sept, 15 Sept (Morning); Decorate Idol/Pooja/Aarti: 16 Sept (Evening)"
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
      const [, area, datesStr, session] = match;
      return {
        area: area.trim(),
        dates: datesStr.split(",").map((d) => d.trim()).filter(Boolean),
        session: session.trim(),
      };
    })
    .filter((s): s is VolunteerSignup => s !== null);
}
