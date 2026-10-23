import { announcementPreview } from "@/lib/announcementPreview";
import { festivalPreview } from "@/lib/festivalPreview";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Announcement";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Used only when the announcement has no video thumbnail of its own (the
 *  page's metadata names that thumbnail directly when there is one). */
export default async function Image({ params }: { params: Promise<{ announcementId: string }> }) {
  const { announcementId } = await params;
  const [festival, announcement] = await Promise.all([festivalPreview(), announcementPreview(announcementId)]);
  return ogCard({
    primary: festival?.primary ?? "#7a1330",
    accent: festival?.accent ?? "#f4791f",
    eyebrow: festival ? `${festival.name} · Announcement` : "Announcement",
    title: announcement?.title ?? festival?.name ?? "Community celebrations",
    lines: announcement?.description ? [announcement.description.slice(0, 90)] : [],
  });
}
