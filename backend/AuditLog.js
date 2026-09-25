/** Records sensitive volunteer actions (spec §32). */
function logAudit(volunteerEmail, action, entity, entityId, oldValue, newValue) {
  appendObject(getSheet(SHEETS.AUDIT_LOG), {
    timestamp: new Date(),
    volunteer_id: volunteerEmail || "system",
    action,
    entity,
    entity_id: entityId,
    old_value: oldValue !== undefined ? String(oldValue) : "",
    new_value: newValue !== undefined ? String(newValue) : "",
  });
}

function listAuditLog(volunteer) {
  requirePermission(volunteer, "Operations");
  return rowsToObjects(getSheet(SHEETS.AUDIT_LOG)).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/** Keeps the live Audit Log sheet small — every request in this app
 *  opens the whole spreadsheet file just to read whichever tab it
 *  needs (SpreadsheetApp.openById()'s cost scales with the whole file,
 *  not the one sheet), and Audit Log is by far the largest sheet in
 *  it. Archiving to a genuinely separate spreadsheet (not just another
 *  tab in the same file — that wouldn't shrink anything) keeps that
 *  file small for every hot resident-facing read, at the cost of the
 *  32 call sites that write an audit entry each now also touching a
 *  second (small) file. That trade only pays off because audited
 *  writes are far rarer than resident reads — worth it here, but not
 *  automatically true for the other sheets.
 *
 *  150 is a row-count cutoff, not a time window — day-to-day audit
 *  volume swings 5x-10x (5 to 60 rows/day observed), so "keep last N
 *  days" doesn't reliably control file size the way "keep last N
 *  rows" does. */
const AUDIT_LOG_LIVE_ROW_COUNT = 150;

function getAuditArchiveSpreadsheet() {
  const existingId = getConfig("audit_archive_spreadsheet_id", "");
  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (e) {
      // Configured id no longer resolves (e.g. file deleted) — fall
      // through and create a fresh one rather than failing archiving.
    }
  }
  const festivalName = getFestivalName();
  const ss = SpreadsheetApp.create(`${festivalName} — Audit Log Archive`);
  const root = getOrCreateFolder(DriveApp.getRootFolder(), festivalName);
  const file = DriveApp.getFileById(ss.getId());
  root.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  setConfig("audit_archive_spreadsheet_id", ss.getId());
  return ss;
}

function getAuditArchiveSheet() {
  const ss = getAuditArchiveSpreadsheet();
  let sheet = ss.getSheetByName("Audit Log Archive");
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName("Audit Log Archive");
    const headers = SHEET_SCHEMAS[SHEETS.AUDIT_LOG];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** "Archive Older Entries" button on the Audit Log page — moves
 *  everything past the most recent AUDIT_LOG_LIVE_ROW_COUNT rows into
 *  the separate archive file, oldest first (append-order in the sheet
 *  already matches chronological order, since logAudit only ever
 *  appends) — sorted explicitly by timestamp instead, and deleted by
 *  actual physical row index (descending, so an earlier deletion never
 *  shifts the row number of one still pending). Slower than trusting
 *  append order, but this is a destructive operation on the one sheet
 *  in this app that exists specifically as a historical record, so
 *  it's worth not depending on an assumption a past manual edit could
 *  have quietly broken. Nothing is deleted, only relocated. Safe to
 *  run anytime, including when there's nothing to archive yet. */
function archiveOldAuditLogEntries(volunteer) {
  requirePermission(volunteer, "Operations");
  return withLock(() => {
    const liveSheet = getSheet(SHEETS.AUDIT_LOG);
    const headers = getHeaders(liveSheet);
    const lastRow = liveSheet.getLastRow();
    if (lastRow < 2) return { archivedCount: 0, remainingCount: 0 };

    const timestampCol = headers.indexOf("timestamp");
    const values = liveSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    const withRowIndex = values.map((row, i) => ({ row, sheetRow: i + 2, timestamp: new Date(row[timestampCol]) }));

    if (withRowIndex.length <= AUDIT_LOG_LIVE_ROW_COUNT) {
      return { archivedCount: 0, remainingCount: withRowIndex.length };
    }

    withRowIndex.sort((a, b) => a.timestamp - b.timestamp);
    const toArchiveCount = withRowIndex.length - AUDIT_LOG_LIVE_ROW_COUNT;
    const toArchive = withRowIndex.slice(0, toArchiveCount);

    const archiveSheet = getAuditArchiveSheet();
    toArchive.forEach(({ row }) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      appendObject(archiveSheet, obj);
    });

    toArchive
      .map(({ sheetRow }) => sheetRow)
      .sort((a, b) => b - a)
      .forEach((sheetRow) => liveSheet.deleteRow(sheetRow));

    logAudit(
      volunteer.email,
      "Archived audit log entries",
      "AuditLog",
      "",
      String(withRowIndex.length),
      String(AUDIT_LOG_LIVE_ROW_COUNT)
    );
    return { archivedCount: toArchiveCount, remainingCount: AUDIT_LOG_LIVE_ROW_COUNT };
  });
}

/** "Show older entries" on the Audit Log page — a separate, explicit
 *  fetch (not loaded by default) since it opens the archive
 *  spreadsheet, a cost only worth paying when someone actually wants
 *  history older than what's live. */
function listArchivedAuditLog(volunteer) {
  requirePermission(volunteer, "Operations");
  return rowsToObjects(getAuditArchiveSheet()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
