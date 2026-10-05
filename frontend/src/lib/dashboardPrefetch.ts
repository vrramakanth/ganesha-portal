import { api } from "./api";

/** Signing in used to run two requests back to back: the sign-in check,
 *  then — only once the dashboard page mounted — the dashboard itself. The
 *  dashboard request carries the same token and the backend verifies it on
 *  its own, so it can start at the same time as the check instead of after
 *  it. The page picks the in-flight request up here rather than sending a
 *  second one. If the token turns out to be bad both requests fail, and the
 *  sign-in screen shows as before. */
type Pending = { token: string; startedAt: number; promise: ReturnType<typeof api.volunteer.dashboard> };

const MAX_AGE_MS = 60 * 1000;
let pending: Pending | null = null;

/** Only worth doing when the dashboard is the page about to be shown. */
export function prefetchDashboard(token: string) {
  if (typeof window === "undefined" || window.location.pathname !== "/volunteer") return;
  const promise = api.volunteer.dashboard(token);
  promise.catch(() => {
    // The page that takes this request reports the failure; don't also
    // raise an unhandled rejection if nothing ever takes it.
  });
  pending = { token, startedAt: Date.now(), promise };
}

/** The prefetched dashboard request for this token, once, or null. */
export function takePrefetchedDashboard(token: string) {
  const taken = pending;
  pending = null;
  if (!taken || taken.token !== token || Date.now() - taken.startedAt > MAX_AGE_MS) return null;
  return taken.promise;
}
