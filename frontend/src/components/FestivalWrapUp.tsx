"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEventDate, formatEventTime } from "@/lib/date";
import { photoAlbumUrl } from "@/lib/photoAlbum";
import type { EventRecord, FeedbackReport, FestivalInfo } from "@/lib/types";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide uppercase text-muted">{title}</p>
      {children}
    </div>
  );
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-center">
      <p className="text-lg font-bold leading-tight text-maroon">{value}</p>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

/** The thank-you shown on Home once a festival without donations has wrapped
 *  up: what happened, day by day, ending with the finale — no money figures.
 *  Everything comes from the festival's own events and settings (closing
 *  message, highlights, poster), so it never shows another festival's data. */
export default function FestivalWrapUp({
  festival,
  events,
  voices,
}: {
  festival: FestivalInfo;
  events: EventRecord[];
  voices: FeedbackReport[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const community = festival.community_name || "Brigade Woods";
  const albumUrl = photoAlbumUrl(festival);
  const poster = festival.wrapup_image_url?.trim();
  const highlights = (festival.wrapup_highlights ?? "")
    .split("\n")
    .map((h) => h.trim())
    .filter(Boolean);

  const timeline = events
    .filter((e) => e.status !== "DRAFT" && e.status !== "CANCELLED")
    .slice()
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return dateDiff !== 0 ? dateDiff : new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  // A festival can state its length outright (Festival Setup) when not every
  // day has an event listed; the events tile is then dropped, since it would
  // undercount.
  const daysOverride = Number(festival.wrapup_days);
  const hasDaysOverride = Number.isInteger(daysOverride) && daysOverride > 0;
  const days = hasDaysOverride ? daysOverride : new Set(timeline.map((e) => formatEventDate(e.date))).size;
  const finale = timeline.length > 1 ? timeline[timeline.length - 1] : null;
  const earlier = finale ? timeline.slice(0, -1) : timeline;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold text-maroon">Thank you, {community} 🙏</h2>
        <p className="text-sm text-muted">{festival.festival_name} has wrapped up</p>
      </div>

      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={`${festival.festival_name} finale`} className="w-full rounded-lg border border-border" />
      )}

      {(hasDaysOverride || timeline.length > 0) && (
        <div className={`grid gap-2 ${hasDaysOverride ? "grid-cols-1" : "grid-cols-2"}`}>
          <Tile value={days} label={days === 1 ? "day of celebration" : "days of celebration"} />
          {!hasDaysOverride && <Tile value={timeline.length} label="events" />}
        </div>
      )}

      {highlights.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {highlights.map((h) => (
            <li key={h}>✓ {h}</li>
          ))}
        </ul>
      )}

      {finale && (
        <Group title="The finale">
          <Link
            href={`/events/${finale.event_id}`}
            className="block rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <p className="text-sm font-semibold">{finale.name}</p>
            <p className="text-xs text-muted">
              {formatEventDate(finale.date)} · {formatEventTime(finale.start_time)} · {finale.location}
            </p>
            {finale.description && <p className="mt-1 text-sm text-muted line-clamp-4">{finale.description}</p>}
          </Link>
        </Group>
      )}

      {earlier.length > 0 && (
        <Group title="How it went">
          <div className="rounded-lg border border-border bg-background divide-y divide-border">
            {earlier.map((e) => (
              <Link key={e.event_id} href={`/events/${e.event_id}`} className="block px-3 py-2.5">
                <p className="text-sm font-semibold">{e.name}</p>
                <p className="text-xs text-muted">
                  {formatEventDate(e.date)} · {formatEventTime(e.start_time)}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </Group>
      )}

      {voices.length > 0 && (
        <Group title="Community Voices">
          <div className="space-y-2">
            {voices.map((f) => {
              const open = !!expanded[f.feedback_id];
              return (
                <div key={f.feedback_id} className="rounded-lg border border-border bg-background px-3 py-2.5">
                  <p className={`text-sm ${open ? "" : "line-clamp-3"}`}>&ldquo;{f.message}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted">— {f.reporter_name || `A ${community} resident`}</p>
                  {f.message.length > 120 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [f.feedback_id]: !prev[f.feedback_id] }))}
                      className="mt-1 text-xs font-semibold text-maroon"
                    >
                      {open ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Group>
      )}

      <div className={`grid gap-2 ${albumUrl ? "grid-cols-2" : "grid-cols-1"}`}>
        {albumUrl && (
          <a
            href={albumUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-saffron py-3 text-center text-sm font-semibold text-on-saffron active:bg-saffron-dark transition-colors"
          >
            Add your photos
          </a>
        )}
        <Link href="/feedback" className="rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon">
          Tell us how you felt
        </Link>
      </div>

      <p className="text-center text-sm font-semibold text-maroon">
        {festival.wrapup_message?.trim() || "Thank you for celebrating with us. Until next year! 🙏"}
      </p>
    </section>
  );
}
