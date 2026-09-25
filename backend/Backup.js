/** Daily backup of the operational spreadsheet (spec §34) — a full
 *  native-Sheets copy, dated, kept in Drive so a bad edit or an
 *  accidental delete during the festival doesn't lose data.
 *
 *  Time-based triggers can't be declared just by pushing code — Apps
 *  Script only creates them when installBackupTrigger() actually runs
 *  once under the project owner's authorization (Apps Script editor:
 *  select it from the function dropdown, Run). Re-running it is safe;
 *  it clears any existing backup trigger first so there's never more
 *  than one. */

function getBackupsFolder() {
  const rootName = getConfig("festival_name", "Ganesha Chathurthi 2026");
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  return getOrCreateFolder(root, "Backups");
}

/** Copies the whole spreadsheet into the Backups folder, named with
 *  today's date (Asia/Kolkata). Safe to call more than once on the same
 *  day — it skips making a second copy if today's already exists,
 *  rather than piling up duplicates from a manual re-run. */
function backupSpreadsheet() {
  const dateStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  const original = SpreadsheetApp.openById(getSpreadsheetId());
  const name = `${original.getName()} — Backup ${dateStr}`;
  const folder = getBackupsFolder();

  const existing = folder.getFilesByName(name);
  if (existing.hasNext()) return { name, url: existing.next().getUrl(), created: false };

  const copyFile = DriveApp.getFileById(original.getId()).makeCopy(name, folder);
  return { name, url: copyFile.getUrl(), created: true };
}

/** Installs (or reinstalls) the daily backup trigger — fires once a day
 *  in a window around 8:00 AM IST; Apps Script's time-based triggers
 *  don't guarantee the exact minute. */
function installBackupTrigger() {
  removeBackupTrigger();
  ScriptApp.newTrigger("backupSpreadsheet")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone("Asia/Kolkata")
    .create();
}

function removeBackupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "backupSpreadsheet")
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

/** "Backup Now" button on the admin Settings page — same backup as the
 *  daily trigger, just on demand, so an admin can confirm it's working
 *  without waiting for 8 AM. */
function runBackupNow(volunteer) {
  requirePermission(volunteer, "Operations");
  const result = backupSpreadsheet();
  logAudit(volunteer.email, "Ran manual backup", "Spreadsheet", result.name, "", result.url);
  return result;
}
