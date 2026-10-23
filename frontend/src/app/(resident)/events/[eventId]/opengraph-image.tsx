import { eventPreview, festivalPreview } from "@/lib/festivalPreview";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Event details";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [festival, event] = await Promise.all([festivalPreview(), eventPreview(eventId)]);
  return ogCard({
    primary: festival?.primary ?? "#7a1330",
    accent: festival?.accent ?? "#f4791f",
    eyebrow: festival?.name ?? "Namma Habba",
    title: event?.name ?? festival?.name ?? "Community celebrations",
    lines: event ? [event.when, event.location] : festival ? [festival.dates, festival.venue] : [],
  });
}
