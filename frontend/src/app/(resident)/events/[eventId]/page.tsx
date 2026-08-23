import EventDetailClient from "@/components/EventDetailClient";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventDetailClient eventId={eventId} />;
}
