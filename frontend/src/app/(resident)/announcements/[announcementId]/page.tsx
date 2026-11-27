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
  // The `images` / `twitter.images` keys are left out entirely (not set to
  // undefined) when there is no video thumbnail, so this folder's
  // opengraph-image card is used instead.
  const image = preview.image
    ? { images: [{ url: preview.image, width: 480, height: 360, alt: preview.title }] }
    : {};
  return {
    title: preview.title,
    description: preview.description,
    openGraph: { title: preview.title, description: preview.description, type: "website", ...image },
    twitter: {
      card: "summary_large_image",
      title: preview.title,
      description: preview.description,
      ...(preview.image ? { images: [preview.image] } : {}),
    },
  };
}

export default async function AnnouncementPage({ params }: Props) {
  const { announcementId } = await params;
  return <AnnouncementDetailClient announcementId={announcementId} />;
}
