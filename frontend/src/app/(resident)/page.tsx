"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatCurrency, formatEventWhen, formatEventTime } from "@/lib/date";
import LoadingIndicator from "@/components/LoadingIndicator";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LinkifiedText from "@/components/LinkifiedText";
import FindYourCounter from "@/components/FindYourCounter";
import DonationsClosed from "@/components/DonationsClosed";
import WrapUpSummary from "@/components/WrapUpSummary";

// Traffic-light read on (spent + worst-case costs ahead) vs collected —
// a resident-facing signal that stays honest (the estimate is real, so
// a genuine shortfall shows red) without ever presenting a forecast as
// settled money already lost. Ratio bands: >105% red, 95-105% amber
// (either side of break-even), <95% green.
const AHEAD_TEXT_COLOR: Record<BadgeTone, string> = {
  danger: "text-red-700",
  warning: "text-amber-700",
  success: "text-green-700",
  info: "text-blue-700",
  neutral: "text-foreground",
};

function costsAheadStatus(
  spent: number,
  futureCosts: number,
  collected: number,
  donationsOpen: boolean
): { tone: BadgeTone; label: string } {
  if (collected <= 0) return { tone: "neutral", label: "" };
  const ratio = (spent + futureCosts) / collected;
  if (ratio > 1.05) return { tone: "danger", label: "Estimated costs ahead exceed what's collected so far" };
  if (ratio >= 0.95) return { tone: "warning", label: donationsOpen ? "Close to fully covered — every donation helps" : "Close to fully covered" };
  return { tone: "success", label: "Comfortably covered" };
}

export default function Home() {
  // Each fetched independently — these used to be bundled into one
  // Promise.all, which meant a hiccup in any single one (this backend,
  // Apps Script, occasionally blips) blanked out the totals, Upcoming,
  // AND News together, even though only one of them actually failed.
  const { data: stats, loading: statsLoading, error: statsError } = useAsync(() => api.stats.public(), []);
  const { data: events, loading: eventsLoading, error: eventsError } = useAsync(() => api.events.list(), []);
  const { data: announcements, error: announcementsError } = useAsync(() => api.announcements.list(), []);
  const { data: feedback } = useAsync(() => api.feedback.listPublished(), []);
  const { data: dinnerCount } = useAsync(() => api.communityDinner.publicCount(), []);
  const [expandedVoices, setExpandedVoices] = useState<Record<string, boolean>>({});
  const [expandedNews, setExpandedNews] = useState<Record<string, boolean>>({});

  const upcoming = (events ?? [])
    .filter((e) => e.status === "OPEN")
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    })
    .slice(0, 2);
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

      {stats?.wrappedUp && (
        <WrapUpSummary stats={stats} eventsCount={(events ?? []).length} dinnerRegistered={dinnerCount?.registered ?? 0} />
      )}

      {stats?.donationsOpen === false ? (
        !stats.wrappedUp && (
          <div className="rounded-xl border border-border bg-card pb-5">
            <DonationsClosed />
          </div>
        )
      ) : (
        <Link
          href="/donate"
          className="w-full rounded-xl bg-saffron py-4 text-center text-lg font-semibold text-white shadow-sm active:bg-saffron-dark transition-colors"
        >
          Donate Now
        </Link>
      )}

      <div className="rounded-xl border border-border bg-card p-5 text-center">
        {statsError ? (
          <p className="text-sm text-muted py-2">Unable to load totals.</p>
        ) : statsLoading || !stats ? (
          <LoadingIndicator label="Loading totals…" className="py-2 justify-center" />
        ) : (
          (() => {
            const ahead = stats.futureCosts > 0 ? costsAheadStatus(stats.totalExpenses, stats.futureCosts, stats.totalCollected, stats.donationsOpen !== false) : null;
            return (
              <>
                <div className="flex items-center justify-center gap-5">
                  <div>
                    <p className="text-xl font-bold text-maroon">{formatCurrency(stats.totalCollected)}</p>
                    <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Collected</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-maroon">{formatCurrency(stats.totalExpenses)}</p>
                    <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Spent</p>
                  </div>
                  {ahead && (
                    <div>
                      <p className={`text-xl font-bold ${AHEAD_TEXT_COLOR[ahead.tone]}`}>
                        ≤{formatCurrency(stats.futureCosts)}
                      </p>
                      <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Expenses Ahead (est.)*</p>
                    </div>
                  )}
                </div>

                {ahead && (
                  <>
                    <div className="mt-3 flex justify-center border-t border-border pt-3">
                      <StatusBadge label={ahead.label} tone={ahead.tone} />
                    </div>
                    <p className="mt-2 text-[10px] leading-snug text-muted">
                      {stats.donationsOpen === false ? (
                        <>
                          *Worst-case estimate for remaining bills — volunteers are working to optimize costs, and
                          final costs are typically lower. Full accounts will be shared once the final bills are
                          settled.
                        </>
                      ) : (
                        <>
                          *Worst-case estimate for remaining costs (dinner catering, closing events) —{" "}
                          <span className="font-semibold text-foreground">donations are still open</span>, volunteers
                          are working to optimize costs, and final costs are typically lower.
                        </>
                      )}
                    </p>
                  </>
                )}

                <p className="mt-2 text-sm text-foreground">{stats.families} families participating</p>
              </>
            );
          })()
        )}
      </div>

      {!stats?.wrappedUp && (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">
          Upcoming
        </h2>
        {eventsError && <p className="text-sm text-red-600">Couldn&apos;t load events — please try again shortly.</p>}
        {!eventsLoading && !eventsError && upcoming.length === 0 && (
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
      )}

      {!stats?.wrappedUp && (
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div>
          <p className="font-semibold">Community Dinner</p>
          <p className="text-xs font-medium text-saffron">20th September, evening — details to follow</p>
          <p className="text-sm font-semibold">Free for all residents</p>
          <p className="text-sm text-muted">
            {dinnerCount?.open === false
              ? "Registrations are now closed. Thank you to everyone who signed up!"
              : "Register your household — one time only. Guests welcome at ₹200/adult, ₹100/child."}
          </p>
          {!!dinnerCount && dinnerCount.registered > 0 && (
            <p className="mt-1 text-sm font-semibold text-maroon">
              {dinnerCount.registered} already registered
            </p>
          )}
        </div>
        {dinnerCount?.open !== false && (
          <Link
            href="/community-dinner"
            className="block w-full rounded-xl bg-maroon py-3 text-center font-semibold text-white active:bg-maroon-dark transition-colors"
          >
            Register
          </Link>
        )}
        <FindYourCounter counters={dinnerCount?.counters} lateCounter={dinnerCount?.lateCounter} />
      </section>
      )}

      {!announcementsError && news.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">News</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {news.slice(0, 2).map((a) => {
              const isExpanded = !!expandedNews[a.announcement_id];
              return (
                <div key={a.announcement_id} className="px-4 py-3">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className={`mt-0.5 text-sm text-muted ${isExpanded ? "" : "line-clamp-2"}`}>
                    <LinkifiedText text={a.message} />
                  </p>
                  {a.message.length > 80 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNews((prev) => ({ ...prev, [a.announcement_id]: !prev[a.announcement_id] }))
                      }
                      className="mt-1 text-xs font-semibold text-maroon"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {news.length > 2 && (
            <Link href="/more" className="block text-center text-xs font-medium text-maroon">
              See all updates →
            </Link>
          )}
        </section>
      )}

      {feedback && feedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Community Voices</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {feedback.slice(0, 2).map((f) => {
              const isExpanded = !!expandedVoices[f.feedback_id];
              return (
                <div key={f.feedback_id} className="px-4 py-3">
                  <p className={`text-sm ${isExpanded ? "" : "line-clamp-2"}`}>&ldquo;{f.message}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted">— {f.reporter_name || "A Brigade Woods resident"}</p>
                  {f.message.length > 80 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedVoices((prev) => ({ ...prev, [f.feedback_id]: !prev[f.feedback_id] }))
                      }
                      className="mt-1.5 text-xs font-semibold text-maroon"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              );
            })}
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
