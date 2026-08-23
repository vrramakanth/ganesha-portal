/** Announcements (spec §30). */

function listActiveAnnouncements() {
  const now = new Date();
  return rowsToObjects(getSheet(SHEETS.ANNOUNCEMENTS)).filter((a) => {
    if (String(a.active).toUpperCase() !== "TRUE") return false;
    if (!a.expires_at) return true;
    return new Date(a.expires_at) > now;
  });
}

function createAnnouncement(volunteer, { title, message, expiresAt, relatedEventId }) {
  requirePermission(volunteer, "Content");
  requireFields({ title, message }, ["title", "message"]);

  const announcement = {
    announcement_id: generateAnnouncementId(),
    title,
    message,
    published_at: new Date(),
    expires_at: expiresAt || "",
    active: "TRUE",
    related_event_id: relatedEventId || "",
  };
  appendObject(getSheet(SHEETS.ANNOUNCEMENTS), announcement);
  logAudit(volunteer.email, "Published announcement", "Announcement", announcement.announcement_id, "", title);
  return announcement;
}

function deactivateAnnouncement(volunteer, announcementId) {
  requirePermission(volunteer, "Content");
  return withLock(() => {
    const sheet = getSheet(SHEETS.ANNOUNCEMENTS);
    const rowIndex = findRowIndexById(sheet, "announcement_id", announcementId);
    if (rowIndex === -1) throw new ApiError("Unknown announcement", 404);
    updateRowFields(sheet, rowIndex, { active: "FALSE" });
    logAudit(volunteer.email, "Deactivated announcement", "Announcement", announcementId, "TRUE", "FALSE");
    return { announcementId, active: false };
  });
}
