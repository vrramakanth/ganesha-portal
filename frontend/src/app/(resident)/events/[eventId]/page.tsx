import type { Metadata } from "next";
import EventDetailClient from "@/components/EventDetailClient";
import { eventPreview } from "@/lib/festivalPreview";
import { eventCardTheme } from "@/lib/eventTheme";

type Props = { params: Promise<{ eventId: string }> };

/** The title and description on a pasted event link; the picture comes from
 *  this folder's opengraph-image. Falls back to the site-wide tags. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = await eventPreview(eventId);
  if (!event) return {};
  // An event with a ready-made picture (e.g. Children's Day) uses it; the rest
  // get this folder's generated opengraph-image.
  const image = eventCardTheme(event.name)?.image;
  const images = image ? [{ url: image, width: 1200, height: 630, alt: event.name }] : undefined;
  return {
    title: event.name,
    description: event.description,
    openGraph: { title: event.name, description: event.description, type: "website", ...(images ? { images } : {}) },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description: event.description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  return <EventDetailClient eventId={eventId} />;
}
