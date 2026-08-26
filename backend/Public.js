/** Public, unauthenticated read endpoints. */

const SUCCESS_STATUSES = ["SUCCESS", "VERIFIED_SUCCESS"];

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
 *  payment references here (spec §13, §33). */
function getPublicStats() {
  const transactions = rowsToObjects(getSheet(SHEETS.TRANSACTIONS)).filter((t) =>
    SUCCESS_STATUSES.includes(t.status)
  );

  const totalCollected = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const families = new Set(transactions.map((t) => `${t.block}|${t.flat_number}`)).size;

  const byBlock = {};
  transactions.forEach((t) => {
    byBlock[t.block] = (byBlock[t.block] || 0) + Number(t.amount || 0);
  });

  return {
    totalCollected,
    donationCount: transactions.length,
    families,
    goal: Number(getConfig("donation_goal", "0")) || 0,
    byBlock: Object.entries(byBlock).map(([block, amount]) => ({ block, amount })),
  };
}
