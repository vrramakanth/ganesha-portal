/** Ganesha's original album link. Only used while the backend predates the
 *  "photo_album_url" Configuration key (festival.get then omits it), so an
 *  un-updated Ganesha deployment keeps its link. */
const LEGACY_PHOTO_ALBUM_URL = "https://photos.app.goo.gl/ZhCpaqaWJnbeGdkk9";

/** The festival's photo album link, or null when it has none (the key is
 *  present but empty), so the button is hidden instead of pointing at
 *  another festival's album. */
export function photoAlbumUrl(festival: { photo_album_url?: string } | null): string | null {
  if (!festival) return null;
  if (festival.photo_album_url === undefined) return LEGACY_PHOTO_ALBUM_URL;
  return festival.photo_album_url.trim() || null;
}
