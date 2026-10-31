"use client";

import { use } from "react";
import { useFestivalConfig } from "@/lib/FestivalConfigContext";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatEventDate, formatEventTime } from "@/lib/date";
import { eventCardTheme } from "@/lib/eventTheme";
import LoadingIndicator from "@/components/LoadingIndicator";

const KEEP_COLOURS = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

/** A cute, printable "houses to visit" sheet for a Flat Opt-in event (Trick
 *  or Treat): the flats that said yes, grouped by block, each with a tick-box
 *  so families can mark houses off as they go. "Save as PDF" is the browser's
 *  own print dialog, so it works on phones and laptops with nothing to
 *  install. */
export default function FlatOptInReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const { data: events, loading: eventsLoading } = useAsync(() => api.events.list(), []);
  const { data: flats, loading: flatsLoading, error } = useAsync(() => api.events.flatList(eventId), [eventId]);
  const event = (events ?? []).find((e) => e.event_id === eventId);
  const { communityName } = useFestivalConfig();

  if (eventsLoading || flatsLoading) return <LoadingIndicator label="Getting the list…" className="px-5 pt-8" />;
  if (error || !event || !flats) {
    return <p className="px-5 pt-8 text-sm text-red-600">{error ?? "Could not load the list."}</p>;
  }

  const theme = eventCardTheme(event.name);
  const primary = theme?.primary ?? "var(--maroon)";
  const accent = theme?.accent ?? "var(--saffron)";
  const byBlock = new Map<string, string[]>();
  flats.participating.forEach((f) => byBlock.set(f.block, [...(byBlock.get(f.block) ?? []), f.flat_number]));
  const halloween = /halloween/i.test(event.name);
  // The browser names a saved PDF after the page title, so set it to a tidy
  // file name: "Brigade Woods Halloween 2026".
  const fileName = halloween
    ? `${communityName} Halloween ${new Date(event.date).toLocaleDateString("en-CA", { year: "numeric", timeZone: "Asia/Kolkata" })}`
    : `${communityName} ${event.name}`;
  function printList() {
    const previous = document.title;
    document.title = fileName;
    window.addEventListener("afterprint", () => (document.title = previous), { once: true });
    window.print();
  }
  const when = [formatEventDate(event.date), formatEventTime(event.start_time), event.location].filter(Boolean).join(" · ");
  const asOf = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 print:px-0 print:pt-0">
      <div className="flex gap-2 print:hidden">
        <button
          type="button"
          onClick={printList}
          className="flex-1 rounded-xl bg-maroon py-3 text-sm font-semibold text-white"
        >
          Save as PDF / Print
        </button>
        <Link
          href={`/events/${eventId}`}
          className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-maroon"
        >
          Back
        </Link>
      </div>

      <section
        className="rounded-2xl px-5 py-6 text-center text-white"
        style={{ background: primary, ...KEEP_COLOURS }}
      >
        <p className="text-4xl">{halloween ? "🎃 👻 🦇" : "🎉"}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-wide">{event.name}</h1>
        <p className="mt-1 text-sm opacity-90">{when}</p>
        <div className="mt-4 flex justify-center gap-3">
          <div className="rounded-xl px-4 py-2" style={{ background: accent, color: "#1b1026", ...KEEP_COLOURS }}>
            <p className="text-2xl font-extrabold leading-none">{flats.participating.length}</p>
            <p className="text-[11px] font-semibold">houses welcoming</p>
          </div>
          {flats.kidsTotal !== undefined && (
            <div className="rounded-xl px-4 py-2" style={{ background: accent, color: "#1b1026", ...KEEP_COLOURS }}>
              <p className="text-2xl font-extrabold leading-none">{flats.kidsTotal}</p>
              <p className="text-[11px] font-semibold">little monsters out</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-border bg-card p-4 text-sm print:break-inside-avoid">
        <p className="font-bold" style={{ color: accent === "var(--saffron)" ? undefined : accent }}>
          Trick-or-treat tips {halloween ? "🍬" : ""}
        </p>
        <ul className="mt-1 space-y-0.5 text-muted">
          <li>🚪 Knock only on the houses listed here, they&apos;re expecting you.</li>
          <li>🗣️ Say &ldquo;Trick or Treat!&rdquo; and don&apos;t forget a big thank you.</li>
          <li>👨‍👩‍👧 Little ones go with a grown-up. Stay together, stay safe.</li>
          <li>✅ Tick each house as you go.</li>
        </ul>
      </section>

      {byBlock.size === 0 && <p className="text-sm text-muted">No houses have said yes yet. Check back soon!</p>}

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {[...byBlock.entries()].map(([block, list]) => (
          <section
            key={block}
            className="rounded-2xl border-2 bg-card p-3 print:break-inside-avoid"
            style={{ borderColor: accent, ...KEEP_COLOURS }}
          >
            <p className="mb-2 flex items-center justify-between text-sm font-extrabold">
              <span>{halloween ? "🏚️" : "🏠"} Block {block}</span>
              <span className="text-xs font-semibold text-muted">{list.length} {list.length === 1 ? "house" : "houses"}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((flat) => (
                <span
                  key={flat}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-sm font-semibold"
                >
                  <span aria-hidden className="inline-block h-3.5 w-3.5 rounded border-2" style={{ borderColor: accent }} />
                  {flat}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="pb-6 text-center text-sm font-semibold print:break-inside-avoid" style={{ color: accent === "var(--saffron)" ? undefined : accent }}>
        {halloween ? "Happy Halloween, Brigade Woods! 👻🎃" : "Have a wonderful time!"}
        <span className="mt-1 block text-[11px] font-normal text-muted">List as of {asOf}. Houses can still be added, so check the page again.</span>
      </p>
    </div>
  );
}
