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

const CONFIG_CACHE_KEY = "configuration_rows";
const CONFIG_CACHE_SECONDS = 300; // 5 min, same as public stats

/** SpreadsheetApp.openById() cost scales with the whole file's size, not
 *  just the sheet being read — and getConfig() used to call it fresh on
 *  every single invocation. Several call sites read multiple keys per
 *  request (getFestivalInfo: 9, createDonation: 2, generateReceipt: 2,
 *  the Seva guideline seeding: 2), so as the spreadsheet has grown from
 *  real use this week, each of those requests was paying that full-open
 *  cost multiple times over. Caching the whole Configuration sheet here
 *  — the lowest common layer — fixes all of those at once instead of
 *  needing a separate cache at each call site. */
function getConfigRows_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CONFIG_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  const rows = rowsToObjects(getSheet(SHEETS.CONFIGURATION));
  cache.put(CONFIG_CACHE_KEY, JSON.stringify(rows), CONFIG_CACHE_SECONDS);
  return rows;
}

/** Reads a value from the Configuration sheet (key/value rows). */
function getConfig(key, fallback) {
  const rows = getConfigRows_();
  const row = rows.find((r) => r.key === key);
  return row ? row.value : fallback;
}

/** Invalidated on every write below, so an admin's change takes effect
 *  on the very next read rather than waiting out the cache TTL. */
function setConfig(key, value) {
  const sheet = getSheet(SHEETS.CONFIGURATION);
  const rowIndex = findRowIndexById(sheet, "key", key);
  if (rowIndex === -1) {
    appendObject(sheet, { key, value });
  } else {
    updateRowFields(sheet, rowIndex, { value });
  }
  CacheService.getScriptCache().remove(CONFIG_CACHE_KEY);
}

/** Configuration keys that touch money — where it goes (upi_vpa,
 *  upi_payee_name) or how much (donation_goal, min/maximum_donation).
 *  An Operations-only admin (no Finance permission) can manage every
 *  other operational setting, but never these — otherwise "no access
 *  to finance info" would still let them redirect where donations pay
 *  out to. */
const FINANCE_ONLY_CONFIG_KEYS = [
  "donation_goal",
  "minimum_donation",
  "maximum_donation",
  "upi_vpa",
  "upi_payee_name",
];

/** Festival configuration (spec §43) — lets volunteers change operational
 *  values without a code change. Seeds the per-area Seva guideline rows
 *  (Volunteers.js) with defaults on first read so they're visible here
 *  to edit even before anyone's been approved yet. Rows in
 *  FINANCE_ONLY_CONFIG_KEYS are left out entirely for an admin without
 *  the Finance permission, rather than just hidden client-side. */
function listConfig(volunteer) {
  requirePermission(volunteer, "Operations");
  seedSevaGuidelineDefaults();
  const rows = getConfigRows_();
  if (volunteer.permissions.includes("Finance")) return rows;
  return rows.filter((r) => !FINANCE_ONLY_CONFIG_KEYS.includes(r.key));
}

function updateConfig(volunteer, updates) {
  requirePermission(volunteer, "Operations");
  const keys = Object.keys(updates || {});
  if (keys.some((k) => FINANCE_ONLY_CONFIG_KEYS.includes(k))) {
    requirePermission(volunteer, "Finance");
  }
  Object.entries(updates || {}).forEach(([key, value]) => {
    const before = getConfig(key, "");
    setConfig(key, value);
    logAudit(volunteer.email, "Updated configuration", "Configuration", key, before, value);
  });
  return listConfig(volunteer);
}
