/**
 * Sheet names and config/property accessors.
 * Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and GOOGLE_OAUTH_CLIENT_ID via
 * Project Settings > Script Properties. SPREADSHEET_ID is optional — if
 * this script is bound to a Sheet (created via clasp create --type sheets,
 * or Extensions > Apps Script from within a Sheet), it's resolved
 * automatically.
 */

const SHEETS = {
  TRANSACTIONS: "Transactions",
  BLOCKS: "Blocks",
  RESIDENTS: "Residents",
  EVENTS: "Events",
  EVENT_REGISTRATIONS: "Event Registrations",
  ENTITLEMENTS: "Entitlements",
  REDEMPTION_LOG: "Redemption Log",
  VOLUNTEERS: "Volunteers",
  VOLUNTEER_ASSIGNMENTS: "Volunteer Assignments",
  EXPENSES: "Expenses",
  ANNOUNCEMENTS: "Announcements",
  CONFIGURATION: "Configuration",
  ADMINS: "Admins",
  AUDIT_LOG: "Audit Log",
  BUGS: "Bugs",
};

function getScriptProperty(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new ApiError(`Missing script property: ${key}`, 500);
  return value;
}

/** Test config (not part of the spec): when the Script Property
 *  TEST_MODE is "true", payment flows skip real Razorpay calls entirely
 *  (see Payments.js) so the whole portal can be exercised end-to-end
 *  before Razorpay keys are set up. Set TEST_MODE=false (or delete the
 *  property) to resume real payments — no other code changes needed. */
function isTestMode() {
  return PropertiesService.getScriptProperties().getProperty("TEST_MODE") === "true";
}

function getSpreadsheetId() {
  const explicit = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (explicit) return explicit;

  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound.getId();

  throw new ApiError(
    "No SPREADSHEET_ID script property, and this script is not bound to a Sheet.",
    500
  );
}

/** Reads a value from the Configuration sheet (key/value rows). */
function getConfig(key, fallback) {
  const rows = rowsToObjects(getSheet(SHEETS.CONFIGURATION));
  const row = rows.find((r) => r.key === key);
  return row ? row.value : fallback;
}

function setConfig(key, value) {
  const sheet = getSheet(SHEETS.CONFIGURATION);
  const rowIndex = findRowIndexById(sheet, "key", key);
  if (rowIndex === -1) {
    appendObject(sheet, { key, value });
  } else {
    updateRowFields(sheet, rowIndex, { value });
  }
}

/** Festival configuration (spec §43) — lets volunteers change operational
 *  values without a code change. Seeds the per-area Seva guideline rows
 *  (Volunteers.js) with defaults on first read so they're visible here
 *  to edit even before anyone's been approved yet. */
function listConfig(volunteer) {
  requirePermission(volunteer, "Operations");
  seedSevaGuidelineDefaults();
  return rowsToObjects(getSheet(SHEETS.CONFIGURATION));
}

function updateConfig(volunteer, updates) {
  requirePermission(volunteer, "Operations");
  Object.entries(updates || {}).forEach(([key, value]) => {
    const before = getConfig(key, "");
    setConfig(key, value);
    logAudit(volunteer.email, "Updated configuration", "Configuration", key, before, value);
  });
  return listConfig(volunteer);
}
