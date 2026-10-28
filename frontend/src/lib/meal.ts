/** What a festival calls its shared meal ("Community Dinner", "Breakfast"…),
 *  from the `meal_name` setting. Falls back to the original wording, so a
 *  festival (or a backend not yet updated) that never set it is unchanged. */
export function mealName(festival: { meal_name?: string } | null): string {
  return festival?.meal_name?.trim() || "Community Dinner";
}

/** The name in lower case for use mid-sentence ("register for the breakfast"). */
export function mealNameLower(festival: { meal_name?: string } | null): string {
  return mealName(festival).toLowerCase();
}

/** "30 Oct" for the registration cut-off setting (YYYY-MM-DD), or null. */
export function mealDeadlineLabel(festival: { meal_registration_deadline?: string } | null): string | null {
  const raw = festival?.meal_registration_deadline?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
