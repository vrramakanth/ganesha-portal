import { CACHED_PUBLIC_ACTIONS } from "@/lib/publicCache";

// The CDN keeps a copy for a minute and, after that, serves the previous copy
// instantly for up to five more while it fetches a fresh one in the background.
const CACHE_HEADER = "public, s-maxage=60, stale-while-revalidate=300";

function failure(message: string, status: number) {
  return Response.json({ ok: false, error: message, status }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Passes a fixed set of public, read-only backend calls through with CDN
 *  caching. Anything else is refused, so this can't be used to reach the
 *  volunteer or resident-data actions. */
export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get("action") ?? "";
  if (!CACHED_PUBLIC_ACTIONS.has(action)) return failure("Unknown action", 404);

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return failure("API is not configured", 500);

  const upstream = new URL(base);
  upstream.searchParams.set("action", action);

  try {
    const res = await fetch(upstream, { cache: "no-store" });
    const text = await res.text();
    const json = JSON.parse(text) as { ok?: boolean };
    // Only a good answer is cached; a backend error page or failure is passed
    // on untouched so a brief blip is never served to everyone.
    if (!json.ok) return new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    return new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": CACHE_HEADER } });
  } catch {
    return failure("Something went wrong. Please try again in a moment.", 502);
  }
}
