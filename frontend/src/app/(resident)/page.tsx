"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatCurrency, formatEventWhen, formatEventTime } from "@/lib/date";
import LoadingIndicator from "@/components/LoadingIndicator";
import StatusBadge from "@/components/StatusBadge";
import LinkifiedText from "@/components/LinkifiedText";

export default function Home() {
  const { data, loading, error } = useAsync(
    () => Promise.all([api.stats.public(), api.events.list(), api.announcements.list()]),
    []
  );
  // Fetched separately from the core stats/events/news above — a hiccup
  // fetching feedback (or the endpoint not existing yet on an older
  // deployed backend) shouldn't take down the rest of the Home page.
  const { data: feedback } = useAsync(() => api.feedback.listPublished(), []);
  const [voiceExpanded, setVoiceExpanded] = useState(false);

  const [stats, events, announcements] = data ?? [null, null, null];
  const upcoming = (events ?? [])
    .filter((e) => e.status === "OPEN")
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    })
    .slice(0, 2);
  const dinnerEvent = (events ?? []).find((e) => e.category === "Dinner" && e.status === "OPEN");
  const news = (announcements ?? [])
    .slice()
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  return (
    <div className="relative flex flex-col gap-4 px-5 pt-3 pb-8">
      <div className="absolute right-4 top-3">
        <a
          href="https://photos.app.goo.gl/ZhCpaqaWJnbeGdkk9"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Magic Moments — view and add your festival photos"
          className="relative flex items-center gap-1.5 rounded-full bg-saffron pl-2.5 pr-3 py-2 text-white shadow-sm active:bg-saffron-dark transition-colors"
        >
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-white">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
              <path d="M10 1.2 12.3 7l6.2.5-4.7 4 1.4 6-5.2-3.1L4.8 17.5l1.4-6-4.7-4L7.7 7 10 1.2Z" />
            </svg>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-xs font-bold">Magic Moments</span>
        </a>
      </div>

      <Image
        src="/images/ganesha-hero.png"
        alt="Lord Ganesha"
        width={242}
        height={306}
        priority
        className="mx-auto h-36 w-auto"
      />

      <header className="text-center space-y-1">
        <p className="text-sm font-semibold tracking-widest text-maroon uppercase">
          Brigade Woods
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Ganesha Chathurthi 2026
        </h1>
        <p className="text-muted text-sm">Celebrate. Participate. Contribute.</p>
      </header>

      <Link
        href="/donate"
        className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white shadow-sm active:bg-saffron-dark transition-colors"
      >
        Donate Now
      </Link>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-5 text-center">
        {error ? (
          <p className="text-sm text-muted py-2">Unable to load totals.</p>
        ) : loading || !stats ? (
          <LoadingIndicator label="Loading totals…" className="py-2 justify-center" />
        ) : (
          <>
            <div className="flex items-center justify-center gap-8">
              <div>
                <p className="text-3xl font-bold text-maroon">{formatCurrency(stats.totalCollected)}</p>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Collected</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-maroon">{formatCurrency(stats.totalExpenses)}</p>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Spent (so far)</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground">{stats.families} families participating</p>
          </>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
          Upcoming
        </h2>
        {!loading && upcoming.length === 0 && (
          <p className="text-sm text-muted">No upcoming events yet.</p>
        )}
        <div className="space-y-2">
          {upcoming.map((event, index) => {
            const isCultural = event.category === "Cultural";
            const isFreeOpen = event.status === "OPEN" && Number(event.fee || 0) === 0;
            // Only the very next event shows the attending count — showing
            // it on every card made "upcoming" feel like a leaderboard
            // instead of pointing at what's happening soonest.
            const attending = index === 0 ? Number(event.rsvp_yes) || 0 : 0;
            return (
              <Link
                key={event.event_id}
                href={`/events/${event.event_id}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 active:bg-background transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-saffron">{formatEventWhen(event.date)}</p>
                    <p className="font-semibold">{event.name}</p>
                  </div>
                  <p className="text-sm text-muted">{formatEventTime(event.start_time)}</p>
                </div>
                {(attending > 0 || isFreeOpen) && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {attending > 0 && <StatusBadge label={`${attending} attending`} tone="success" />}
                    {isFreeOpen && isCultural && (
                      <>
                        <p className="animate-twinkle text-xs font-bold text-saffron">Register to perform →</p>
                        <p className="text-xs font-bold text-maroon">RSVP to attend →</p>
                      </>
                    )}
                    {isFreeOpen && !isCultural && (
                      <p className="animate-twinkle text-xs font-bold text-saffron">RSVP to attend →</p>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
        <Link href="/events" className="block text-center text-xs font-medium text-maroon">
          View all events →
        </Link>
      </section>

      {!loading && !error && news.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">News</h2>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="font-semibold text-sm">{news[0].title}</p>
            <p className="mt-0.5 text-sm text-muted">
              <LinkifiedText text={news[0].message} />
            </p>
          </div>
          {news.length > 1 && (
            <Link href="/more" className="block text-center text-xs font-medium text-maroon">
              See all updates →
            </Link>
          )}
        </section>
      )}

      {dinnerEvent && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <p className="font-semibold">{dinnerEvent.name}</p>
            <p className="text-sm text-muted">Registrations open</p>
          </div>
          <Link
            href="/dinner"
            className="block w-full rounded-xl bg-maroon py-3 text-center font-semibold text-white active:bg-maroon-dark transition-colors"
          >
            Register
          </Link>
        </section>
      )}

      {feedback && feedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Community Voices</h2>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className={`text-sm ${voiceExpanded ? "" : "line-clamp-4"}`}>
              &ldquo;{feedback[0].message}&rdquo;
            </p>
            <p className="mt-1 text-xs text-muted">— {feedback[0].reporter_name || "A Brigade Woods resident"}</p>
            {feedback[0].message.length > 160 && (
              <button
                type="button"
                onClick={() => setVoiceExpanded((v) => !v)}
                className="mt-1.5 text-xs font-semibold text-maroon"
              >
                {voiceExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        </section>
      )}

      <a
        href="/docs/user-guide.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto text-xs font-medium text-muted"
      >
        Need help?
      </a>

      <Link
        href="/admin"
        className="mx-auto text-xs font-medium text-muted"
      >
        Admin Login
      </Link>
    </div>
  );
}
