/** Master menu of performance types an organizer can offer on a Cultural
 *  event — kept in one place so the admin edit/create form and the
 *  resident registration form can't drift. Which of these a specific
 *  event actually offers lives on that event's own sub_categories field
 *  (comma-separated); this constant is only the full set to choose from,
 *  and the fallback when an event hasn't set that field yet. */
export const CULTURAL_SUB_CATEGORIES = ["Dance", "Vocal/Singing", "Instrument", "Recitation", "Other"];

/** Renamed option labels — a value already saved on an event's
 *  sub_categories under an old name still needs to keep matching (and
 *  show as checked in the edit form) after the rename, without requiring
 *  every existing event to be re-saved by hand. */
const SUB_CATEGORY_ALIASES: Record<string, string> = { Vocal: "Vocal/Singing" };
function normalizeSubCategory(name: string): string {
  return SUB_CATEGORY_ALIASES[name] || name;
}

/** Parses an event's raw sub_categories field with no fallback — "" stays
 *  []. Used to seed the admin edit form's checkboxes with exactly what's
 *  stored, so an event that hasn't had this set yet starts unchecked
 *  rather than appearing to already offer everything. */
export function parseSubCategories(subCategories?: string): string[] {
  return String(subCategories || "")
    .split(",")
    .map((s) => normalizeSubCategory(s.trim()))
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
