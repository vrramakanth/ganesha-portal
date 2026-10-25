import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import SystemUnderTestBanner from "@/components/SystemUnderTestBanner";
import AnnouncementsTicker from "@/components/AnnouncementsTicker";
import { festivalPreview } from "@/lib/festivalPreview";
import { FestivalConfigProvider } from "@/lib/FestivalConfigContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const FALLBACK_TITLE = "Namma Habba | Brigade Woods";
const FALLBACK_DESCRIPTION = "Brigade Woods community celebrations — events, volunteering and more.";

/** Site-wide tags for this festival, read from its own settings so a link
 *  to any page shows the festival's name and dates (and, from
 *  opengraph-image, its colours) rather than one fixed title. */
export async function generateMetadata(): Promise<Metadata> {
  const festival = await festivalPreview();
  // Image links in the tags must be absolute and on the festival's own
  // address; the default (the deployment's *.vercel.app URL) can sit behind
  // Vercel's deployment protection, where a chat app's crawler is refused.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const title = festival ? `${festival.name} | ${festival.community}` : FALLBACK_TITLE;
  const description = festival
    ? [festival.tagline, festival.theme && `Theme: ${festival.theme}`, festival.dates, festival.venue].filter(Boolean).join(" · ") || FALLBACK_DESCRIPTION
    : FALLBACK_DESCRIPTION;
  return {
    ...(host ? { metadataBase: new URL(`${proto}://${host}`) } : {}),
    title,
    description,
    openGraph: { title, description, type: "website", siteName: festival?.name },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <FestivalConfigProvider>
          <SystemUnderTestBanner />
          <AnnouncementsTicker />
          {children}
        </FestivalConfigProvider>
        <Analytics />
      </body>
    </html>
  );
}
