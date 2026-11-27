/** A link-card look for an event that isn't the festival's own theme — a
 *  Halloween night held inside a Rajyotsava portal shouldn't be shared as a
 *  red-and-yellow Rajyotsava card. Matched on the event's name, so there's
 *  nothing to set up: name it "Halloween …" and its card follows. */
/** `image` is a ready-made picture (under /public) used as the link-card
 *  picture instead of the generated colour card. */
export type EventCardTheme = { primary: string; accent: string; decor?: "pumpkin" | "balloons"; image?: string };

export function eventCardTheme(eventName: string): EventCardTheme | null {
  if (/halloween/i.test(eventName)) return { primary: "#1b1026", accent: "#ff7a00", decor: "pumpkin" };
  // The apostrophe may be straight (') or the curly one phone keyboards type (’).
  if (/child(?:ren)?['\u2018\u2019`]?s?\s*day|fiesta\s*fantasia/i.test(eventName)) {
    return { primary: "#1457c9", accent: "#ffd23f", decor: "balloons", image: "/images/childrens-day-card.jpg" };
  }
  return null;
}
