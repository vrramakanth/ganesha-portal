import type { Metadata } from "next";
import EventDetailClient from "@/components/EventDetailClient";
import { eventPreview } from "@/lib/festivalPreview";

type Props = { params: Promise<{ eventId: string }> };

/** The title and description on a pasted event link; the picture comes from
 *  this folder's opengraph-image. Falls back to the site-wide tags. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = await eventPreview(eventId);
  if (!event) return {};
  return {
    title: event.name,
    description: event.description,
    openGraph: { title: event.name, description: event.description, type: "website" },
    twitter: { card: "summary_large_image", title: event.name, description: event.description },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  return <EventDetailClient eventId={eventId} />;
}
