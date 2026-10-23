import { festivalPreview } from "@/lib/festivalPreview";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Namma Habba community celebrations";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The picture on any link to this festival that doesn't have a more
 *  specific one — built from the festival's own name, dates and colours. */
export default async function Image() {
  const festival = await festivalPreview();
  return ogCard({
    primary: festival?.primary ?? "#7a1330",
    accent: festival?.accent ?? "#f4791f",
    eyebrow: festival?.community ?? "Namma Habba",
    title: festival?.name ?? "Community celebrations",
    lines: festival ? [festival.dates, festival.venue] : ["Events, volunteering and more"],
  });
}
