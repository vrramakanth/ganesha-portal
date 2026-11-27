import { youTubeId } from "./youtube";

/** What a chat app needs to draw a link card for one announcement. */
export type AnnouncementPreview = { title: string; description: string; image: string | null };

const MAX_DESCRIPTION = 160;

/** Link cards (WhatsApp, Telegram and the like) are built from the page's
 *  own title and image tags, read before any JavaScript runs — so the
 *  announcement page, which fills itself in in the browser, always looked
 *  like the generic site. This looks the announcement up on the server so
 *  those tags can name it and show its video's thumbnail instead.
 *
 *  Returns null for anything it can't resolve (unknown, expired or
 *  deactivated announcement, backend slow or down), and the page falls back
 *  to the site-wide tags. The backend list is cached for five minutes, so
 *  most requests answer fast enough for a chat app's crawler to wait on. */
export async function announcementPreview(announcementId: string): Promise<AnnouncementPreview | null> {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return null;
  try {
    const res = await fetch(`${api}?action=announcements.list`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json()) as { ok?: boolean; data?: { announcement_id: string; title: string; message: string }[] };
    if (!body.ok || !Array.isArray(body.data)) return null;
    const announcement = body.data.find((a) => a.announcement_id === announcementId);
    if (!announcement) return null;

    const links = announcement.message.match(/https?:\/\/[^\s]+/g) ?? [];
    let videoId: string | null = null;
    for (const link of links) {
      // Same trailing-punctuation rule LinkifiedText uses for the link itself.
      videoId = youTubeId(link.replace(/[.,;:!?)\]}'"]+$/, ""));
      if (videoId) break;
    }

    let description = announcement.message.replace(/https?:\/\/[^\s]+/g, "").replace(/\s+/g, " ").trim();
    if (!description && videoId) description = "Watch the video";
    if (description.length > MAX_DESCRIPTION) description = `${description.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;

    return {
      title: announcement.title,
      description,
      image: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
    };
  } catch {
    return null;
  }
}
