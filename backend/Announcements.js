/** Announcements (spec §30). */

const ANNOUNCEMENTS_CACHE_KEY = "announcements_rows";
const ANNOUNCEMENTS_CACHE_SECONDS = 60;

function getAnnouncementRows_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(ANNOUNCEMENTS_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  const rows = rowsToObjects(getSheet(SHEETS.ANNOUNCEMENTS));
  cache.put(ANNOUNCEMENTS_CACHE_KEY, JSON.stringify(rows), ANNOUNCEMENTS_CACHE_SECONDS);
  return rows;
}

function invalidateAnnouncementsCache() {
  CacheService.getScriptCache().remove(ANNOUNCEMENTS_CACHE_KEY);
}

/** Caches the raw rows, not the active/expiry filter result, so an
 *  announcement still disappears exactly on its expires_at instant on
 *  every call rather than up to a minute late. */
function listActiveAnnouncements() {
  const now = new Date();
  return getAnnouncementRows_().filter((a) => {
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
  invalidateAnnouncementsCache();
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
    invalidateAnnouncementsCache();
    logAudit(volunteer.email, "Deactivated announcement", "Announcement", announcementId, "TRUE", "FALSE");
    return { announcementId, active: false };
  });
}
