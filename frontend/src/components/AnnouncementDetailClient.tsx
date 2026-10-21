"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/track";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatEventDate } from "@/lib/date";
import LinkifiedText from "@/components/LinkifiedText";
import LoadingIndicator from "@/components/LoadingIndicator";
import PageHeader from "@/components/PageHeader";

/** One announcement on its own page, so it has a link that can be shared
 *  (e.g. on WhatsApp) and opens straight to it — including any YouTube
 *  video in the message, which plays here. It finds the announcement in
 *  the same list Home shows, so an announcement that has been
 *  deactivated or has expired is simply no longer found. */
export default function AnnouncementDetailClient({ announcementId }: { announcementId: string }) {
  const { data, loading, error } = useAsync(() => api.announcements.list(), []);
  const announcement = data?.find((a) => a.announcement_id === announcementId);
  const found = !!announcement;

  useEffect(() => {
    if (found) trackEvent("announcement_open", { id: announcementId });
  }, [found, announcementId]);

  if (loading) return <LoadingIndicator label="Loading announcement…" className="px-5 pt-8" />;

  if (error) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8">
        <PageHeader title="Announcement" backHref="/" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-8">
        <PageHeader title="Announcement not available" backHref="/" />
        <p className="text-sm text-muted">
          This announcement may have been removed or has expired. You can find the latest updates on the{" "}
          <Link href="/" className="font-semibold text-maroon underline">
            Home page
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-8">
      <PageHeader
        title={announcement.title}
        subtitle={announcement.published_at ? formatEventDate(announcement.published_at) : undefined}
        backHref="/"
      />
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="whitespace-pre-line text-sm text-foreground">
          <LinkifiedText text={announcement.message} />
        </p>
      </div>
    </div>
  );
}
