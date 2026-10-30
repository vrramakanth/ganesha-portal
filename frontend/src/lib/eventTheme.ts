/** A link-card look for an event that isn't the festival's own theme — a
 *  Halloween night held inside a Rajyotsava portal shouldn't be shared as a
 *  red-and-yellow Rajyotsava card. Matched on the event's name, so there's
 *  nothing to set up: name it "Halloween …" and its card follows. */
export type EventCardTheme = { primary: string; accent: string; decor?: "pumpkin" };

export function eventCardTheme(eventName: string): EventCardTheme | null {
  if (/halloween/i.test(eventName)) return { primary: "#1b1026", accent: "#ff7a00", decor: "pumpkin" };
  return null;
}
