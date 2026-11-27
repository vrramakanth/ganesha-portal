import type { EventRecord } from "./types";

/** An unlisted event is hidden from the portal's own lists (Home, Events,
 *  the wrap-up) but still opens at its direct link and takes registrations —
 *  for an event promoted elsewhere, e.g. from the hub. Sheets may hand the
 *  flag back as the text "TRUE" or as a real boolean. */
export function isUnlisted(event: Pick<EventRecord, "unlisted">): boolean {
  return String(event.unlisted).toUpperCase() === "TRUE";
}
