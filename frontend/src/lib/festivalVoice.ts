import type { FestivalInfo } from "@/lib/types";

/** Matches a Ganesha Chathurthi deployment by its configured name. Only used
 *  to keep Ganesha's own wording where a festival hasn't configured its own,
 *  so other festivals never inherit it. */
const GANESHA_NAME = /ganesh|ganpati|ganapati|vinayaka/i;

export const GANESHA_CLOSING_MESSAGE = "Ganpati Bappa Morya! Pudhchya Varshi Lavkar Ya! 🙏";

export function isGaneshaFestival(festival: Pick<FestivalInfo, "festival_name"> | null): boolean {
  return GANESHA_NAME.test(festival?.festival_name ?? "");
}

/** The festival's sign-off line (the "closing_message" Configuration key),
 *  or "" for none. A backend that predates the key omits it; then only a
 *  Ganesha deployment gets its traditional farewell. */
export function closingMessage(festival: Pick<FestivalInfo, "festival_name" | "closing_message"> | null): string {
  if (!festival) return "";
  if (festival.closing_message !== undefined) return festival.closing_message.trim();
  return isGaneshaFestival(festival) ? GANESHA_CLOSING_MESSAGE : "";
}
