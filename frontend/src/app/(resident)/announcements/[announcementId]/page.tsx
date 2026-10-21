import type { Metadata } from "next";
import AnnouncementDetailClient from "@/components/AnnouncementDetailClient";
import { announcementPreview } from "@/lib/announcementPreview";

type Props = { params: Promise<{ announcementId: string }> };

/** The link card chat apps show when this address is pasted: the
 *  announcement's title, a short description, and its video's thumbnail. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { announcementId } = await params;
  const preview = await announcementPreview(announcementId);
  if (!preview) return {};
  const images = preview.image ? [{ url: preview.image, width: 480, height: 360, alt: preview.title }] : undefined;
  return {
    title: preview.title,
    description: preview.description,
    openGraph: { title: preview.title, description: preview.description, type: "website", images },
    twitter: {
      card: preview.image ? "summary_large_image" : "summary",
      title: preview.title,
      description: preview.description,
      images: preview.image ? [preview.image] : undefined,
    },
  };
}

export default async function AnnouncementPage({ params }: Props) {
  const { announcementId } = await params;
  return <AnnouncementDetailClient announcementId={announcementId} />;
}
