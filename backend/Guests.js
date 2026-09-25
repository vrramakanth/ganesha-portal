/** Guests module — a public, admin-managed list of dignitaries (spec:
 *  Karnataka Rajyotsava's "Chief Guests" card). New and self-heals on
 *  first use, same pattern as `getBugsSheet()`, so it works even before
 *  someone re-runs `setupSheets()` for a deployment that predates this.
 *  Gated by the "guests" module (Modules.js) at the router, so this file
 *  itself doesn't need to check whether the module is on. */

function getGuestsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.GUESTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.GUESTS);
    const headers = SHEET_SCHEMAS[SHEETS.GUESTS];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Public — sorted by sort_order (lower first), then by when they were
 *  added, so a fresh guest with no explicit order just lands at the end. */
function listGuests() {
  return rowsToObjects(getGuestsSheet()).sort((a, b) => {
    const orderDiff = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

function createGuest(volunteer, { name, title, sortOrder, photoImage, mimeType }) {
  requirePermission(volunteer, "Events");
  requireFields({ name }, ["name"]);

  const photoUrl = photoImage ? uploadDriveImage("Guests", photoImage, mimeType, "guest-photo") : "";

  return withLock(() => {
    const guest = {
      guest_id: generateGuestId(),
      name: String(name).trim(),
      title: title ? String(title).trim() : "",
      photo_url: photoUrl,
      sort_order: Number(sortOrder) || 0,
      created_at: new Date(),
    };
    appendObject(getGuestsSheet(), guest);
    logAudit(volunteer.email, "Added guest", "Guest", guest.guest_id, "", guest.name);
    return guest;
  });
}

function updateGuest(volunteer, guestId, { name, title, sortOrder, photoImage, mimeType }) {
  requirePermission(volunteer, "Events");
  return withLock(() => {
    const sheet = getGuestsSheet();
    const rowIndex = findRowIndexById(sheet, "guest_id", guestId);
    if (rowIndex === -1) throw new ApiError("Unknown guest", 404);
    const before = getRowObject(sheet, rowIndex);

    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (title !== undefined) update.title = String(title).trim();
    if (sortOrder !== undefined) update.sort_order = Number(sortOrder) || 0;
    if (photoImage) update.photo_url = uploadDriveImage("Guests", photoImage, mimeType, "guest-photo");

    updateRowFields(sheet, rowIndex, update);
    logAudit(volunteer.email, "Edited guest", "Guest", guestId, before.name, update.name || before.name);
    return Object.assign({}, before, update, { guest_id: guestId });
  });
}

function deleteGuest(volunteer, guestId) {
  requirePermission(volunteer, "Events");
  return withLock(() => {
    const sheet = getGuestsSheet();
    const rowIndex = findRowIndexById(sheet, "guest_id", guestId);
    if (rowIndex === -1) throw new ApiError("Unknown guest", 404);
    const before = getRowObject(sheet, rowIndex);
    sheet.deleteRow(rowIndex);
    logAudit(volunteer.email, "Removed guest", "Guest", guestId, before.name, "");
    return { guestId };
  });
}
