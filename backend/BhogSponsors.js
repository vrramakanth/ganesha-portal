/** Bhog Sponsor tracking — a simple coordination log for who's
 *  sponsoring which evening's Maha Prasadam (14-20 Sept, always
 *  evening, so no time slot — see the Maha Prasadam announcement).
 *
 *  Deliberately not a new kind of donation: the amount is always a
 *  reference to an existing verified Transaction picked by the admin
 *  (or left unlinked if the sponsor paid outside the app — e.g. cash
 *  or UPI handed directly to a volunteer). This sheet never feeds into
 *  stats.public/Festival Summary, since that would double-count money
 *  already recorded elsewhere. */

const BHOG_DATE_MIN = "2026-09-14";
const BHOG_DATE_MAX = "2026-09-20";

function ensureBhogSponsorsSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEETS.BHOG_SPONSORS);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEETS.BHOG_SPONSORS);
    const headers = SHEET_SCHEMAS[SHEETS.BHOG_SPONSORS];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function validateBhogDate(bhogDate) {
  const value = String(bhogDate || "").slice(0, 10);
  if (value < BHOG_DATE_MIN || value > BHOG_DATE_MAX) {
    throw new ApiError("Bhog date must be between 14 and 20 September", 400);
  }
  return value;
}

/** Looks up a resident's name (same source as Community Dinner's
 *  Lookup button) plus their successful donations, so the admin
 *  recording a sponsorship can pick the right one instead of typing
 *  an amount from memory — and so a sponsor with no matching donation
 *  (paid outside the app) falls back to manual entry instead of
 *  blocking the whole form. */
function lookupBhogSponsorDonations(volunteer, mobile) {
  requireFields({ mobile }, ["mobile"]);
  validateMobile(mobile);
  const resident = findResidentByMobile(mobile);
  const donations = listDonationsByMobile(mobile).filter((d) => SUCCESS_STATUSES.includes(d.status));
  return {
    name: resident ? resident.name : "",
    donations,
  };
}

/** Open to any signed-in admin, same as recording an Expense (§30) —
 *  whoever's coordinating Bhog sign-ups on the ground shouldn't need a
 *  specific permission just to log who's sponsoring which evening.
 *  `transactionIds` can be more than one — a sponsor's contribution
 *  toward one evening might be made up of several donations — stored
 *  comma-separated, same convention as sub_categories/approved_areas
 *  elsewhere in this backend. */
function recordBhogSponsor(volunteer, { mobile, residentName, transactionIds, amount, bhogDate }) {
  requireFields({ mobile, residentName, amount, bhogDate }, ["mobile", "residentName", "amount", "bhogDate"]);
  validateMobile(mobile);
  const date = validateBhogDate(bhogDate);
  const amountNum = Number(amount) || 0;
  if (amountNum <= 0) throw new ApiError("Enter a valid sponsorship amount", 400);

  return withLock(() => {
    const sheet = ensureBhogSponsorsSheet();
    const sponsor = {
      sponsor_id: generateBhogSponsorId(),
      mobile,
      resident_name: residentName,
      transaction_id: Array.isArray(transactionIds) ? transactionIds.filter(Boolean).join(",") : "",
      amount: amountNum,
      bhog_date: date,
      recorded_by: volunteer.email,
      created_at: new Date(),
    };
    appendObject(sheet, sponsor);
    logAudit(volunteer.email, "Recorded Bhog sponsor", "BhogSponsors", sponsor.sponsor_id, "", `${residentName} - ${date}`);
    return sponsor;
  });
}

function listBhogSponsors(volunteer) {
  return rowsToObjects(ensureBhogSponsorsSheet()).sort(
    (a, b) => new Date(a.bhog_date) - new Date(b.bhog_date) || new Date(a.created_at) - new Date(b.created_at)
  );
}
