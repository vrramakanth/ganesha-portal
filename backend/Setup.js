/** Run setupSheets() once (Run > setupSheets in the Apps Script editor,
 *  with SPREADSHEET_ID already set in Script Properties) to create every
 *  sheet and header row this backend expects (spec §34, §51). Safe to
 *  re-run — it only creates what's missing, never touches existing rows. */

const SHEET_SCHEMAS = {
  [SHEETS.TRANSACTIONS]: [
    "transaction_id", "resident_id", "created_at", "resident_name", "block", "flat_number",
    "mobile", "email", "amount", "currency", "payment_provider", "payment_order_id",
    "payment_id", "payment_reference", "status", "verified_at", "receipt_id", "receipt_url",
    "source", "admin_notes", "updated_at",
  ],
  [SHEETS.BLOCKS]: ["block_id", "block_name", "active"],
  [SHEETS.RESIDENTS]: [
    "resident_id", "name", "mobile", "email", "block", "flat_number", "created_at", "updated_at",
  ],
  [SHEETS.EVENTS]: [
    "event_id", "name", "description", "date", "start_time", "end_time", "location", "category",
    "age_group", "capacity", "registration_required", "registration_deadline", "fee", "status",
    "contact_volunteer", "token_code",
  ],
  [SHEETS.EVENT_REGISTRATIONS]: [
    "registration_id", "event_id", "resident_id", "participant_name", "participant_age", "block",
    "flat_number", "mobile", "parent_name", "parent_mobile", "status", "check_in_at", "created_at",
  ],
  [SHEETS.ENTITLEMENTS]: [
    "entitlement_id", "event_id", "resident_id", "token_id", "allocated_quantity",
    "redeemed_quantity", "remaining_quantity", "source", "status", "block", "flat_number", "created_at",
  ],
  [SHEETS.REDEMPTION_LOG]: [
    "redemption_id", "entitlement_id", "quantity", "counter_id", "volunteer_id", "redeemed_at",
  ],
  [SHEETS.VOLUNTEERS]: [
    "volunteer_id", "resident_id", "name", "mobile", "block", "flat_number", "areas",
    "availability", "status", "created_at",
  ],
  [SHEETS.VOLUNTEER_ASSIGNMENTS]: [
    "assignment_id", "volunteer_id", "event_id", "area", "shift", "status",
  ],
  [SHEETS.EXPENSES]: [
    "expense_id", "vendor", "description", "budget", "actual", "payment_status",
    "invoice_reference", "created_at",
  ],
  [SHEETS.ANNOUNCEMENTS]: [
    "announcement_id", "title", "message", "published_at", "expires_at", "active", "related_event_id",
  ],
  [SHEETS.CONFIGURATION]: ["key", "value"],
  [SHEETS.ADMINS]: ["email", "name", "permissions", "active"],
  [SHEETS.AUDIT_LOG]: [
    "timestamp", "volunteer_id", "action", "entity", "entity_id", "old_value", "new_value",
  ],
  [SHEETS.BUGS]: [
    "bug_id", "description", "screenshot_url", "status", "reporter_name", "reporter_mobile",
    "page_url", "reported_at", "updated_at",
  ],
};

function setupSheets() {
  const ss = getSpreadsheet();

  Object.entries(SHEET_SCHEMAS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });

  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  seedDefaults();
  return { sheets: Object.keys(SHEET_SCHEMAS), spreadsheetUrl: ss.getUrl() };
}

function seedDefaults() {
  const config = getSheet(SHEETS.CONFIGURATION);
  if (rowsToObjects(config).length === 0) {
    [
      ["festival_name", "Ganesha Chathurthi 2026"],
      ["dates", "22-30 Aug 2026"],
      ["venue", "Brigade Woods Community Hall"],
      ["donation_goal", "750000"],
      ["minimum_donation", "100"],
      ["contact", "volunteer@brigadewoods.org"],
      ["volunteer_requirements", '{"Food":12,"Events":10,"Parking":8,"Kids":8,"Clean-up":7}'],
    ].forEach(([key, value]) => appendObject(config, { key, value }));
  }

  const blocks = getSheet(SHEETS.BLOCKS);
  if (rowsToObjects(blocks).length === 0) {
    BLOCK_NAMES.forEach((name) => appendObject(blocks, { block_id: `BLK-${name}`, block_name: name, active: "TRUE" }));
  }
}

/** Block letters residents may pick from (no I/O — easily confused with 1/0). */
const BLOCK_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S"];

/** One-off migration: replaces whatever is in the Blocks sheet with
 *  BLOCK_NAMES. Run this once from the Apps Script editor if the sheet was
 *  already seeded with the old placeholder block names ("Block 1", etc.)
 *  — safe to re-run, always leaves the sheet matching BLOCK_NAMES exactly. */
function resetBlocks() {
  const sheet = getSheet(SHEETS.BLOCKS);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  BLOCK_NAMES.forEach((name) => appendObject(sheet, { block_id: `BLK-${name}`, block_name: name, active: "TRUE" }));
  return { blocks: BLOCK_NAMES };
}
