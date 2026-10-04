import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SystemUnderTestBanner from "@/components/SystemUnderTestBanner";
import AnnouncementsTicker from "@/components/AnnouncementsTicker";
import { FestivalConfigProvider } from "@/lib/FestivalConfigContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Namma Habba | Brigade Woods",
  description: "Brigade Woods community celebrations — events, volunteering and more.",
  openGraph: {
    title: "Namma Habba | Brigade Woods",
    description: "Brigade Woods community celebrations — events, volunteering and more.",
  },
};

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
