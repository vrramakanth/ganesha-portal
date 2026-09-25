import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SystemUnderTestBanner from "@/components/SystemUnderTestBanner";
import AnnouncementsTicker from "@/components/AnnouncementsTicker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brigade Woods | Ganesha Utsav 2026",
  description: "Donate, register for events, and get your dinner token — Brigade Woods Ganesha Utsav 2026.",
  openGraph: {
    title: "Brigade Woods | Ganesha Utsav 2026",
    description: "Donate, register for events, and get your dinner token — Brigade Woods Ganesha Utsav 2026.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SystemUnderTestBanner />
        <AnnouncementsTicker />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
