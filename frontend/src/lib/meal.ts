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

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

/** The "day and place" line. A value a spreadsheet turned into a date
 *  arrives as a timestamp ("2026-11-01T03:15:00.000Z"); show it as a day and
 *  time in India time rather than raw. Text typed as text is shown as is. */
export function mealWhen(festival: { meal_when?: string } | null): string | null {
  const raw = festival?.meal_when?.trim();
  if (!raw) return null;
  if (!ISO_DATETIME.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

/** "30 Oct" for the registration cut-off setting (YYYY-MM-DD, or a timestamp
 *  a spreadsheet made of it), or null. */
export function mealDeadlineLabel(festival: { meal_registration_deadline?: string } | null): string | null {
  const raw = festival?.meal_registration_deadline?.trim();
  if (!raw) return null;
  let day = raw;
  if (ISO_DATETIME.test(raw)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, dd] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
