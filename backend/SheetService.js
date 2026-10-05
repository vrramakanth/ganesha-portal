/** Generic helpers for treating a Sheet's header row as an object schema. */

/** SpreadsheetApp.openById() cost scales with the whole file's size, not
 *  just the sheet being read (see the identical note on getConfigRows_ in
 *  Config.js) — and most handlers call getSheet() several times per
 *  request (once per sheet touched, sometimes the same sheet twice).
 *  Memoized per script execution: each Web App request is one fresh,
 *  single-threaded execution with no state shared across requests, so
 *  this only ever avoids redundant opens within a single request, never
 *  serves a stale handle across requests. */
let cachedSpreadsheet_ = null;
function getSpreadsheet() {
  if (!cachedSpreadsheet_) {
    cachedSpreadsheet_ = SpreadsheetApp.openById(getSpreadsheetId());
  }
  return cachedSpreadsheet_;
}

/** Sheet objects, memoized for the same reason as the spreadsheet above
 *  (one execution = one request) — and so the header cache below can key
 *  on the object. */
const sheetObjects_ = {};
function getSheet(name) {
  if (!sheetObjects_[name]) {
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) throw new ApiError(`Sheet not found: ${name}`, 500);
    sheetObjects_[name] = sheet;
  }
  return sheetObjects_[name];
}

/** Header rows, read once per sheet per execution. getHeaders() is called
 *  by almost every helper below (a single approve action used to read the
 *  same header row six times), and each read is a separate Sheets call.
 *  Anything that changes a header row must call resetHeaderCache_(). */
const headerCache_ = new Map();
function resetHeaderCache_(sheet) {
  headerCache_.delete(sheet);
}

/** Dashboard results are cached for a short time (Reports.js); any write
 *  made through these helpers drops them so totals never trail an action
 *  this same app just performed. */
const DASHBOARD_CACHE_KEYS = ["dashboard_v1_0", "dashboard_v1_1"];
function invalidateDashboardCache_() {
  CacheService.getScriptCache().removeAll(DASHBOARD_CACHE_KEYS);
}

function getHeaders(sheet) {
  if (headerCache_.has(sheet)) return headerCache_.get(sheet).slice();
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  headerCache_.set(sheet, headers);
  return headers.slice();
}

/** Reads every data row into an array of { header: value } objects. */
function rowsToObjects(sheet) {
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

/** Appends a row, writing each header's matching key (blank if absent). */
function appendObject(sheet, obj) {
  const headers = getHeaders(sheet);
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ""));
  sheet.appendRow(row);
  invalidateDashboardCache_();
  return obj;
}

/** 1-based sheet row index (not array index) of the row whose column
 *  `idColumn` equals `idValue`, or -1 if not found. */
function findRowIndexById(sheet, idColumn, idValue) {
  const headers = getHeaders(sheet);
  const col = headers.indexOf(idColumn);
  if (col === -1) throw new ApiError(`Unknown column: ${idColumn}`, 500);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(idValue)) return i + 2;
  }
  return -1;
}

function getRowObject(sheet, rowIndex) {
  const headers = getHeaders(sheet);
  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => (obj[h] = values[i]));
  return obj;
}

/** Adds a header column if it doesn't already exist — lets a handler
 *  introduce a new field on a sheet that was already created and
 *  populated, without needing setupSheets() re-run (which only fills in
 *  headers for brand-new sheets). */
function ensureColumn(sheet, columnName) {
  const headers = getHeaders(sheet);
  if (headers.includes(columnName)) return;
  sheet.getRange(1, headers.length + 1).setValue(columnName);
  resetHeaderCache_(sheet);
}

/** Updates only the given fields (by header name) on a specific row. */
function updateRowFields(sheet, rowIndex, fields) {
  const headers = getHeaders(sheet);
  Object.keys(fields).forEach((key) => {
    const col = headers.indexOf(key);
    if (col === -1) throw new ApiError(`Unknown column: ${key}`, 500);
    sheet.getRange(rowIndex, col + 1).setValue(fields[key]);
  });
  invalidateDashboardCache_();
}

/** Runs fn holding the script-wide lock — use around read-modify-write
 *  sequences (id generation, entitlement redemption) that must not race
 *  across concurrent requests. */
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
