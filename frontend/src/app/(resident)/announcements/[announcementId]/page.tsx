import AnnouncementDetailClient from "@/components/AnnouncementDetailClient";

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ announcementId: string }>;
}) {
  const { announcementId } = await params;
  return <AnnouncementDetailClient announcementId={announcementId} />;
}
