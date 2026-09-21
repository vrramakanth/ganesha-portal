import Link from "next/link";
import { formatCurrency } from "@/lib/date";
import type { PublicStats } from "@/lib/types";

const PHOTOS_URL = "https://photos.app.goo.gl/ZhCpaqaWJnbeGdkk9";

/** 2025 figures from the Ganesh Utsav 2025 master sheet: flats with a
 *  contribution (169 of about 335) and the sum of the 17 block totals. */
const LAST_YEAR = { flatsDonated: 169, totalFlats: 335, raised: 165921 };

/** Portal usage as of 21 Sep 2026. Page views and the busiest day are from
 *  Vercel Web Analytics (it started recording on 15 Sep); the rest are counts
 *  from the portal's own data. Receipts are passed in live. */
/** Festival facts from the events list and the cultural nominations. */
const FESTIVAL = { days: 7, aarthis: 11 };

const PORTAL = {
  pageViews: "3,200+",
  busiestDayVisitors: 190,
  residentsOnPortal: 254,
  culturalNominations: 22,
  performers: 15,
  bhogSponsors: 4,
  bhogEvenings: 3,
};

const percentMore = (now: number, before: number) => Math.round((now / before - 1) * 100);

function Tile({
  value,
  label,
  delta,
  wide,
}: {
  value: string | number;
  label: string;
  delta?: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-border bg-background px-3 py-2.5 text-center ${wide ? "col-span-2" : ""}`}>
      <p className="text-lg font-bold leading-tight text-maroon">{value}</p>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
      {delta && <p className="mt-0.5 text-[11px] font-semibold text-green-700">{delta}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide uppercase text-muted">{title}</p>
      {children}
    </div>
  );
}

/** The thank-you shown on Home once the festival has wrapped up. Money and
 *  headcount figures come from live data; the comparison is against 2025. */
export default function WrapUpSummary({
  stats,
  eventsCount,
}: {
  stats: PublicStats;
  eventsCount: number;
}) {
  const perFlat = stats.families > 0 ? stats.totalCollected / stats.families : 0;
  const lastPerFlat = LAST_YEAR.raised / LAST_YEAR.flatsDonated;
  const participation = Math.round((stats.families / LAST_YEAR.totalFlats) * 100);
  const lastParticipation = Math.round((LAST_YEAR.flatsDonated / LAST_YEAR.totalFlats) * 100);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold text-maroon">This year, we did it differently</h2>
        <p className="text-sm text-muted">Thank you, Brigade Woods 🙏 Until next year!</p>
      </div>

      <Group title="Donations vs last year">
        <div className="grid grid-cols-2 gap-2">
          <Tile
            value={formatCurrency(stats.totalCollected)}
            label="raised"
            delta={`+${percentMore(stats.totalCollected, LAST_YEAR.raised)}%`}
          />
          <Tile
            value={stats.families}
            label={`flats donated, all ${stats.byBlock.length} blocks`}
            delta={`+${percentMore(stats.families, LAST_YEAR.flatsDonated)}%`}
          />
          <Tile
            value={formatCurrency(perFlat)}
            label="average per flat"
            delta={`+${percentMore(perFlat, lastPerFlat)}%`}
          />
          <Tile value={`${participation}%`} label="of flats donated" delta={`was ${lastParticipation}%`} />
        </div>
      </Group>

      <Group title="Festival Week">
        <div className="grid grid-cols-2 gap-2">
          <Tile value={1} label="idol fully sponsored by one resident" />
          <Tile value={PORTAL.bhogSponsors} label={`Bhog sponsors, ${PORTAL.bhogEvenings} evenings`} />
          <Tile value="20+" label="active volunteers doing seva every day" />
          <Tile value="150+" label="residents every day for evening aarti and bhog" />
          <Tile value={FESTIVAL.days} label="days, 14 to 20 Sep" />
          <Tile value={eventsCount} label="poojas, aarthis, programmes" />
          <Tile value={FESTIVAL.aarthis} label="morning and evening aarthis by our residents" />
          <Tile value={PORTAL.culturalNominations} label={`cultural entries, ${PORTAL.performers} performers`} />
        </div>
        <ul className="space-y-0.5 text-sm">
          <li>✓ Several unique bhog daily, for 6 days</li>
          <li>✓ All building up to the grand dinner</li>
          <li>✓ Residents&apos; own bhajan evening</li>
          <li>✓ Dance, singing and recitation on cultural night</li>
          <li>✓ Aster Whitefield Hospital launch on cultural night</li>
          <li>✓ A sacred farewell to Bappa at Visarjan</li>
        </ul>
      </Group>

      <Group title="Community Dinner">
        <div className="grid grid-cols-2 gap-2">
          <Tile value="500+" label="dinners served" />
          <Tile value="< 90 min" label="was 150+ min" delta="40%+ faster" />
        </div>
        <ul className="space-y-0.5 text-sm">
          <li>✓ Online registration</li>
          <li>✓ No physical tokens to distribute</li>
          <li>✓ No block reps going door to door</li>
        </ul>
      </Group>

      <Group title="Portal">
        <div className="grid grid-cols-2 gap-2">
          <Tile value={PORTAL.pageViews} label="page views, last 7 days" />
          <Tile value={PORTAL.busiestDayVisitors} label="online on busiest day" />
          <Tile value={PORTAL.residentsOnPortal} label="residents on portal" />
          <Tile value={stats.donationCount} label="digital receipts" />
        </div>
      </Group>

      <p className="text-center text-sm">
        Thank you: donors · volunteers · performers · sponsors, incl. Aster Whitefield Hospital
      </p>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={PHOTOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-saffron py-3 text-center text-sm font-semibold text-white active:bg-saffron-dark transition-colors"
        >
          Add your photos
        </a>
        <Link href="/feedback" className="rounded-xl border border-border py-3 text-center text-sm font-semibold text-maroon">
          Share your experience
        </Link>
      </div>

      <div className="space-y-0.5 text-center">
        <p className="text-xs font-semibold text-muted">Final accounts: coming in a day or two</p>
        <p className="text-sm font-semibold text-maroon">Ganpati Bappa Morya! Pudhchya Varshi Lavkar Ya! 🙏</p>
      </div>
    </section>
  );
}
