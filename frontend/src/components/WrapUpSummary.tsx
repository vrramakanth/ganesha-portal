import Link from "next/link";
import { formatCurrency } from "@/lib/date";
import type { PublicStats } from "@/lib/types";

const PHOTOS_URL = "https://photos.app.goo.gl/ZhCpaqaWJnbeGdkk9";

/** The thank-you shown on Home once the festival has wrapped up. Numbers
 *  come from live data, so they stay right until the last payment is
 *  verified. */
export default function WrapUpSummary({
  stats,
  eventsCount,
  dinnerRegistered,
}: {
  stats: PublicStats;
  eventsCount: number;
  dinnerRegistered: number;
}) {
  const blocks = stats.byBlock.length;
  const goalMet = stats.goal > 0 && stats.totalCollected >= stats.goal;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-bold text-maroon">Thank You, Brigade Woods 🙏</h2>
        <p className="text-sm text-muted">
          As we bid Bappa a loving farewell until next year, our hearts are full. Thank you for making Ganesha
          Chathurthi 2026 a celebration to remember.
        </p>
      </div>

      <div className="space-y-2.5 text-sm">
        <p className="font-semibold">Together, we did this:</p>
        <p>
          <span className="font-bold text-maroon">{formatCurrency(stats.totalCollected)}</span> contributed by{" "}
          <span className="font-bold text-maroon">{stats.families}</span> families
          {blocks > 0 && <> from {blocks === 17 ? "all 17 blocks" : `${blocks} blocks`}</>}
          {goalMet && <>, going past our {formatCurrency(stats.goal)} goal</>}
        </p>
        {dinnerRegistered > 0 && (
          <p>
            <span className="font-bold text-maroon">{dinnerRegistered}</span> of us together at the Community Dinner
          </p>
        )}
        {eventsCount > 0 && (
          <p>
            <span className="font-bold text-maroon">{eventsCount}</span> poojas, aarthis, bhajans and cultural
            programmes across the festival
          </p>
        )}
      </div>

      <p className="text-sm">
        Our sincere thanks to every donor, volunteer, performer and sponsor, including Aster Whitefield Hospital. This
        happened because you showed up.
      </p>

      <div className="space-y-2">
        <p className="text-sm font-semibold">A little more from you</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={PHOTOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-saffron py-3 text-center text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
          >
            Add your photos
          </a>
          <Link
            href="/feedback"
            className="rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon"
          >
            Share your experience
          </Link>
        </div>
      </div>

      <p className="text-xs text-muted text-center">Full accounts will be shared once the final bills are settled.</p>
      <p className="text-sm font-semibold text-maroon text-center">Ganpati Bappa Morya! Pudhchya Varshi Lavkar Ya! 🙏</p>
    </section>
  );
}
