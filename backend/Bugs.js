/** Bug reporting. Public submission (anyone can report, no sign-in
 *  needed — a bug in the sign-in flow itself should still be reportable),
 *  volunteer-only listing/triage. Screenshots are stored in Drive, never
 *  in the Sheet itself (same pattern as Receipts.js). */

function getBugScreenshotsFolder() {
  const rootName = getConfig("festival_name", "Ganesha Chathurthi 2026");
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  return getOrCreateFolder(root, "Bug Screenshots");
}

/** The Bugs sheet is new and setupSheets() is a manual, editor-only step —
 *  self-heal here rather than depend on someone remembering to run it. */
function getBugsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.BUGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.BUGS);
    const headers = SHEET_SCHEMAS[SHEETS.BUGS];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function reportBug({ description, screenshot, mimeType, reporterName, reporterMobile, pageUrl }) {
  requireFields({ description }, ["description"]);

  let screenshotUrl = "";
  if (screenshot) {
    try {
      const bytes = Utilities.base64Decode(screenshot);
      const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", "bug-screenshot");
      const file = getBugScreenshotsFolder().createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      screenshotUrl = file.getUrl();
    } catch (err) {
      // Fail soft — a bad/oversized image shouldn't lose the report itself.
      screenshotUrl = "";
    }
  }

  return withLock(() => {
    const bug = {
      bug_id: generateBugId(),
      description,
      screenshot_url: screenshotUrl,
      status: "OPEN",
      reporter_name: reporterName || "",
      reporter_mobile: reporterMobile || "",
      page_url: pageUrl || "",
      reported_at: new Date(),
      updated_at: new Date(),
    };
    appendObject(getBugsSheet(), bug);
    return bug;
  });
}

/** Every bug, open and closed — the volunteer screen filters/labels them,
 *  the backend just returns the full list. */
function listBugs(volunteer) {
  requirePermission(volunteer, "Operations");
  return rowsToObjects(getBugsSheet());
}

function updateBugStatus(volunteer, bugId, status) {
  requirePermission(volunteer, "Operations");
  if (status !== "OPEN" && status !== "CLOSED") {
    throw new ApiError('Status must be "OPEN" or "CLOSED"', 400);
  }
  return withLock(() => {
    const sheet = getBugsSheet();
    const rowIndex = findRowIndexById(sheet, "bug_id", bugId);
    if (rowIndex === -1) throw new ApiError("Unknown bug", 404);
    const before = getRowObject(sheet, rowIndex);

    updateRowFields(sheet, rowIndex, { status, updated_at: new Date() });
    logAudit(volunteer.email, "Updated bug status", "Bug", bugId, before.status, status);
    return { bugId, status };
  });
}
