import { track } from "@vercel/analytics";

/** Records a named click/action in Vercel Web Analytics (Events tab).
 *  Never throws and never blocks the UI — analytics must not break a page.
 *  Custom events need a Vercel plan that includes them; elsewhere the call
 *  is simply ignored. Keep names short and properties to simple values. */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  try {
    track(name, props);
  } catch {
    // ignore
  }
}
