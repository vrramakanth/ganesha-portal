/** Volunteer dashboard summary and CSV exports (spec §27, §31). */

function getVolunteerDashboard(volunteer) {
  const transactions = rowsToObjects(getSheet(SHEETS.TRANSACTIONS));
  const successful = transactions.filter((t) => SUCCESS_STATUSES.includes(t.status));
  const allEntitlements = rowsToObjects(getSheet(SHEETS.ENTITLEMENTS));
  const entitlements = allEntitlements.filter((e) => ACTIVATED_ENTITLEMENT_STATUSES.includes(e.status));
  const volunteers = rowsToObjects(getSheet(SHEETS.VOLUNTEERS)).filter((v) => v.status === "ACTIVE");
  const events = rowsToObjects(getSheet(SHEETS.EVENTS));

  const alerts = [];
  const needsReview = transactions.filter((t) => t.status === "MANUAL_REVIEW").length;
  if (needsReview > 0) alerts.push(`${needsReview} payments need review`);
  const dinnerNeedsReview = allEntitlements.filter((e) => e.status === ENTITLEMENT_STATUS.MANUAL_REVIEW).length;
  if (dinnerNeedsReview > 0) alerts.push(`${dinnerNeedsReview} dinner payments need review`);

  const closingToday = events.filter((e) => {
    if (!e.registration_deadline) return false;
    const today = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    return Utilities.formatDate(new Date(e.registration_deadline), "Asia/Kolkata", "yyyy-MM-dd") === today;
  }).length;
  if (closingToday > 0) alerts.push(`${closingToday} events close registration today`);

  return {
    collected: successful.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    donationCount: successful.length,
    mealsRegistered: entitlements.reduce((sum, e) => sum + Number(e.allocated_quantity || 0), 0),
    mealsServed: entitlements.reduce((sum, e) => sum + Number(e.redeemed_quantity || 0), 0),
    volunteerCount: volunteers.length,
    alerts,
  };
}

const REPORT_BUILDERS = {
  donations: () =>
    rowsToObjects(getSheet(SHEETS.TRANSACTIONS)).map((t) => ({
      transaction_id: t.transaction_id,
      resident_name: t.resident_name,
      block: t.block,
      flat_number: t.flat_number,
      amount: t.amount,
      status: t.status,
      created_at: t.created_at,
    })),
  registrations: () => rowsToObjects(getSheet(SHEETS.EVENT_REGISTRATIONS)),
  dinner: () => rowsToObjects(getSheet(SHEETS.ENTITLEMENTS)),
  volunteers: () => rowsToObjects(getSheet(SHEETS.VOLUNTEERS)),
};

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
  return lines.join("\n");
}

function exportReportCsv(volunteer, reportKey) {
  requirePermission(volunteer, "Finance");
  const builder = REPORT_BUILDERS[reportKey];
  if (!builder) throw new ApiError(`Unknown report: ${reportKey}`, 400);
  return { filename: `${reportKey}.csv`, csv: toCsv(builder()) };
}
