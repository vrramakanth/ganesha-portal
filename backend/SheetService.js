/** Generic helpers for treating a Sheet's header row as an object schema. */

function getSpreadsheet() {
  return SpreadsheetApp.openById(getSpreadsheetId());
}

function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new ApiError(`Sheet not found: ${name}`, 500);
  return sheet;
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
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
}

/** Updates only the given fields (by header name) on a specific row. */
function updateRowFields(sheet, rowIndex, fields) {
  const headers = getHeaders(sheet);
  Object.keys(fields).forEach((key) => {
    const col = headers.indexOf(key);
    if (col === -1) throw new ApiError(`Unknown column: ${key}`, 500);
    sheet.getRange(rowIndex, col + 1).setValue(fields[key]);
  });
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
