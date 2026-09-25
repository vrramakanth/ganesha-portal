/** Public, unauthenticated read endpoints. */

const SUCCESS_STATUSES = ["SUCCESS", "VERIFIED_SUCCESS"];
const PUBLIC_STATS_CACHE_KEY = "public_stats";
// 10 min — was 5, doubled as the operational spreadsheet grew (19 sheets,
// ~15.7K cells as of mid-festival): SpreadsheetApp.openById() cost scales
// with the whole file, not just this sheet, so halving how often this
// cache-misses meaningfully cuts load during peak traffic, at the cost
// of slightly staler public totals.
const PUBLIC_STATS_CACHE_SECONDS = 600;

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
    "community_dinner_counter_map",
  ];
  const info = {};
  keys.forEach((k) => (info[k] = getConfig(k, "")));
  // Same fallback as the backend actually enforces in createDonation, so
  // the frontend can validate against a real number even before anyone
  // has added a maximum_donation row to Configuration.
  info.maximum_donation = getConfig("maximum_donation", "100000");
  // Read-only fallback here — no seeding side-effect from a public,
  // unauthenticated call. The row itself gets created for editing the
  // first time an Operations admin opens Settings (listConfig).
  info.admin_whatsapp_number = getConfig("admin_whatsapp_number", ADMIN_WHATSAPP_DEFAULT);
  info.donations_open = isDonationsOpen() ? "true" : "false";
  info.festival_wrapped_up = isFestivalWrappedUp() ? "true" : "false";
  info.future_costs_closed = isFutureCostsClosed() ? "true" : "false";
  // Namma Habba framework additions — community identity and the module
  // registry (Modules.js), so the frontend can build its nav/pages from
  // one call instead of hardcoding which festival features exist.
  info.community_name = getCommunityName();
  info.modules = getEnabledModules();
  return info;
}

const BLOCKS_CACHE_KEY = "blocks_rows";
const BLOCKS_CACHE_SECONDS = 300; // 5 min — blocks are effectively static, edited only via the Apps Script editor

/** Caches the raw rows, not the "active" filter result, so a block's
 *  active flag still applies live on every call rather than baking a
 *  point-in-time filter into the cache. There's no live write path for
 *  Blocks today (only the editor-only resetBlocks()), so there's nothing
 *  to invalidate this from — an editor-run change simply takes up to the
 *  TTL to show up, which is fine for something this rare. */
function listBlocks() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(BLOCKS_CACHE_KEY);
  const rows = cached ? JSON.parse(cached) : rowsToObjects(getSheet(SHEETS.BLOCKS));
  if (!cached) cache.put(BLOCKS_CACHE_KEY, JSON.stringify(rows), BLOCKS_CACHE_SECONDS);
  return rows.filter((b) => String(b.active).toUpperCase() === "TRUE");
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
  // donationsOpen is read live (config is already cached), never baked
  // into the cached stats, so closing donations shows up immediately.
  if (cached) return Object.assign(JSON.parse(cached), { donationsOpen: isDonationsOpen(), wrappedUp: isFestivalWrappedUp() });

  const transactions = rowsToObjects(getSheet(SHEETS.TRANSACTIONS)).filter((t) =>
    SUCCESS_STATUSES.includes(t.status)
  );

  const totalCollected = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // Anonymous eHundi offerings (source: "HUNDI") have no block/flat — they
  // still count toward totalCollected above, but "families" and the
  // block-wise breakdown only make sense for named givers, so they're
  // excluded here rather than showing up as a bogus "|" family or a
  // blank-labeled block. Sponsorships (block SPONSOR, no flat) are
  // excluded the same way: they count toward the total, but aren't a
  // household or a residential block.
  const namedTransactions = transactions.filter(
    (t) => t.block && t.flat_number && t.block !== SPONSOR_BLOCK
  );
  const families = new Set(namedTransactions.map((t) => `${t.block}|${t.flat_number}`)).size;

  const byBlock = {};
  namedTransactions.forEach((t) => {
    byBlock[t.block] = (byBlock[t.block] || 0) + Number(t.amount || 0);
  });

  const stats = {
    totalCollected,
    donationCount: transactions.length,
    families,
    goal: Number(getConfig("donation_goal", "0")) || 0,
    byBlock: Object.entries(byBlock).map(([block, amount]) => ({ block, amount })),
    // Aggregate only, same principle as totalCollected above — a single
    // approved-expenses sum, never itemized or attributed to a spender.
    totalExpenses: getExpensesTotal(),
    // A worst-case planning estimate, not money already spent — shown
    // to residents alongside totalExpenses so Home can flag when
    // (spent + estimated ahead) is closing in on what's been collected,
    // without ever presenting the estimate as a settled fact.
    futureCosts: getFutureCostsTotal(),
  };

  cache.put(PUBLIC_STATS_CACHE_KEY, JSON.stringify(stats), PUBLIC_STATS_CACHE_SECONDS);
  return Object.assign({}, stats, { donationsOpen: isDonationsOpen(), wrappedUp: isFestivalWrappedUp() });
}

/** Called after any action that changes the verified-donation totals
 *  (currently: a volunteer verifying a payment) so the Home page
 *  reflects it on the next load instead of waiting out the cache TTL. */
function invalidatePublicStatsCache() {
  CacheService.getScriptCache().remove(PUBLIC_STATS_CACHE_KEY);
}
