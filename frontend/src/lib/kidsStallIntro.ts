/** A short, punchy intro shown above a Kids Stall event's sign-up form, so
 *  parents see what the day is before the long description. Matched on the
 *  event's name like the link-card themes; null for other events. */
export type KidsStallIntro = { headline: string; line: string };

export function kidsStallIntro(eventName: string): KidsStallIntro | null {
  if (/child(?:ren)?['‘’`]?s?\s*day|fiesta\s*fantasia/i.test(eventName)) {
    return {
      headline: "Fiesta Fantasia 2.0: Eat, Play, Laugh, Repeat! A fair planned and run entirely by our kids.",
      line: "Kids under 18 run stalls (games, food, crafts, used books), everyone plays Tambola, and the money raised supports Angels Orphanage, Bangalore. Stall registrations close 12 Nov.",
    };
  }
  return null;
}
