/** Public, unauthenticated read endpoints. */

const SUCCESS_STATUSES = ["SUCCESS", "VERIFIED_SUCCESS"];
const PUBLIC_STATS_CACHE_KEY = "public_stats";
const PUBLIC_STATS_CACHE_SECONDS = 300; // 5 min — spec §52 explicitly allows caching public aggregates

function getFestivalInfo() {
  const keys = [
    "festival_name",
    "dates",
    "venue",
    "donation_goal",
    "minimum_donation",
    "contact",
    "upi_vpa",
    "upi_payee_name",
  ];
  const info = {};
  keys.forEach((k) => (info[k] = getConfig(k, "")));
  // Same fallback as the backend actually enforces in createDonation, so
  // the frontend can validate against a real number even before anyone
  // has added a maximum_donation row to Configuration.
  info.maximum_donation = getConfig("maximum_donation", "100000");
  return info;
}

function listBlocks() {
  return rowsToObjects(getSheet(SHEETS.BLOCKS)).filter(
    (b) => String(b.active).toUpperCase() === "TRUE"
  );
}

/** Aggregate-only — never expose names, flats, amounts per resident, or
 *  payment references here (spec §13, §33).
 *
 *  Recomputing this by scanning every Transactions row on every Home
 *  page load doesn't scale as donations grow, especially under
 *  concurrent load (e.g. a WhatsApp broadcast bringing many residents
 *  in at once). Cached script-wide for a few minutes — see
 *  invalidatePublicStatsCache(), called right after a payment is
 *  verified, so a fresh donation shows up quickly rather than waiting
 *  out the full TTL. */
function getPublicStats() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PUBLIC_STATS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const transactions = rowsToObjects(getSheet(SHEETS.TRANSACTIONS)).filter((t) =>
    SUCCESS_STATUSES.includes(t.status)
  );

  const totalCollected = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const families = new Set(transactions.map((t) => `${t.block}|${t.flat_number}`)).size;

  const byBlock = {};
  transactions.forEach((t) => {
    byBlock[t.block] = (byBlock[t.block] || 0) + Number(t.amount || 0);
  });

  const stats = {
    totalCollected,
    donationCount: transactions.length,
    families,
    goal: Number(getConfig("donation_goal", "0")) || 0,
    byBlock: Object.entries(byBlock).map(([block, amount]) => ({ block, amount })),
  };

  cache.put(PUBLIC_STATS_CACHE_KEY, JSON.stringify(stats), PUBLIC_STATS_CACHE_SECONDS);
  return stats;
}

/** Called after any action that changes the verified-donation totals
 *  (currently: a volunteer verifying a payment) so the Home page
 *  reflects it on the next load instead of waiting out the cache TTL. */
function invalidatePublicStatsCache() {
  CacheService.getScriptCache().remove(PUBLIC_STATS_CACHE_KEY);
}
