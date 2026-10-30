import { eventPreview, festivalPreview } from "@/lib/festivalPreview";
import { eventCardTheme } from "@/lib/eventTheme";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Event details";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [festival, event] = await Promise.all([festivalPreview(), eventPreview(eventId)]);
  // An event with its own look (e.g. Halloween) isn't dressed in the host
  // festival's colours or named after it.
  const theme = event ? eventCardTheme(event.name) : null;
  return ogCard({
    primary: theme?.primary ?? festival?.primary ?? "#7a1330",
    accent: theme?.accent ?? festival?.accent ?? "#f4791f",
    decor: theme?.decor,
    eyebrow: theme ? (festival?.community ?? "Namma Habba") : (festival?.name ?? "Namma Habba"),
    title: event?.name ?? festival?.name ?? "Community celebrations",
    lines: event ? [event.when, event.location] : festival ? [festival.dates, festival.venue] : [],
  });
}
