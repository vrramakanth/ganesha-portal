/** Resident feedback. Public submission (no sign-in, same spirit as Bug
 *  Reporting) — but nothing a resident writes here is shown to anyone
 *  else until a volunteer with the Content permission reviews it and
 *  chooses to publish it (Decision 4's "an admin decides" principle,
 *  applied to what's said about the festival, not just what's paid for
 *  it). Declined feedback stays recorded for the organizing team but
 *  never becomes public. */

/** The Feedback sheet is new and setupSheets() is a manual, editor-only
 *  step — self-heal here rather than depend on someone remembering to
 *  run it (same pattern as getBugsSheet()). */
function getFeedbackSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.FEEDBACK);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.FEEDBACK);
    const headers = SHEET_SCHEMAS[SHEETS.FEEDBACK];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function submitFeedback({ message, reporterName, reporterMobile, pageUrl }) {
  requireFields({ message }, ["message"]);

  return withLock(() => {
    const feedback = {
      feedback_id: generateFeedbackId(),
      message,
      reporter_name: reporterName || "",
      reporter_mobile: reporterMobile || "",
      page_url: pageUrl || "",
      status: "PENDING",
      reviewed_by: "",
      reviewed_at: "",
      created_at: new Date(),
      updated_at: new Date(),
    };
    appendObject(getFeedbackSheet(), feedback);
    return feedback;
  });
}

/** Every piece of feedback, any status — the volunteer screen filters by
 *  status itself, the backend just returns the full list (same pattern
 *  as listBugs). */
function listFeedback(volunteer) {
  requirePermission(volunteer, "Content");
  return rowsToObjects(getFeedbackSheet());
}

function updateFeedbackStatus(volunteer, feedbackId, status) {
  requirePermission(volunteer, "Content");
  if (!["PENDING", "PUBLISHED", "DECLINED"].includes(status)) {
    throw new ApiError('Status must be "PENDING", "PUBLISHED" or "DECLINED"', 400);
  }
  return withLock(() => {
    const sheet = getFeedbackSheet();
    const rowIndex = findRowIndexById(sheet, "feedback_id", feedbackId);
    if (rowIndex === -1) throw new ApiError("Unknown feedback", 404);
    const before = getRowObject(sheet, rowIndex);

    updateRowFields(sheet, rowIndex, {
      status,
      reviewed_by: volunteer.email,
      reviewed_at: new Date(),
      updated_at: new Date(),
    });
    logAudit(volunteer.email, "Updated feedback status", "Feedback", feedbackId, before.status, status);
    return { feedbackId, status };
  });
}

/** Public — only what an admin has explicitly published, newest first.
 *  No caching: publishing is a deliberate, infrequent admin action, not
 *  a hot path that needs the CacheService treatment stats.public gets. */
function listPublishedFeedback() {
  return rowsToObjects(getFeedbackSheet())
    .filter((f) => f.status === "PUBLISHED")
    .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at));
}
