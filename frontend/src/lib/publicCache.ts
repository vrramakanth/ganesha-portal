/** Read-only public actions with no parameters. The backend (Google Apps
 *  Script) takes 1.5 to 3 seconds per call even when it answers from its own
 *  cache, so these are served through /api/public, which Vercel's CDN caches. */
export const CACHED_PUBLIC_ACTIONS = new Set([
  "stats.public",
  "events.list",
  "announcements.list",
  "communityDinner.publicCount",
  "feedback.listPublished",
  "festival.get",
  "blocks.list",
  "guests.list",
]);
