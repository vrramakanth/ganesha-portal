/** Master menu of performance types an organizer can offer on a Cultural
 *  event — kept in one place so the admin edit/create form and the
 *  resident registration form can't drift. Which of these a specific
 *  event actually offers lives on that event's own sub_categories field
 *  (comma-separated); this constant is only the full set to choose from,
 *  and the fallback when an event hasn't set that field yet. */
export const CULTURAL_SUB_CATEGORIES = ["Dance", "Vocal", "Instrument", "Recitation", "Other"];

/** Parses an event's raw sub_categories field with no fallback — "" stays
 *  []. Used to seed the admin edit form's checkboxes with exactly what's
 *  stored, so an event that hasn't had this set yet starts unchecked
 *  rather than appearing to already offer everything. */
export function parseSubCategories(subCategories?: string): string[] {
  return String(subCategories || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** An event's own allowed sub-categories, or the full master list as a
 *  fallback for an event that hasn't had them set yet — used on the
 *  resident-facing registration form, where registration must keep
 *  working even before an organizer has gotten around to narrowing it
 *  down. */
export function eventSubCategories(subCategories?: string): string[] {
  const list = parseSubCategories(subCategories);
  return list.length ? list : CULTURAL_SUB_CATEGORIES;
}
