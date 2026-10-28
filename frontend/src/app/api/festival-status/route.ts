/** A tiny public status for this festival, read by the Namma Habba hub
 *  (nammahabba.in) to decide whether to list the festival under "Happening
 *  now" or "Past festivals" — so marking the festival wrapped up here is
 *  all it takes, with no change to the hub's own list. Only public facts,
 *  the same ones festival.get already serves to anyone. */
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return Response.json({ ok: false }, { status: 503, headers: CORS });
  try {
    const res = await fetch(`${api}?action=festival.get`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      data?: { festival_name?: string; festival_wrapped_up?: string };
    };
    if (!body.ok || !body.data) return Response.json({ ok: false }, { status: 502, headers: CORS });
    return Response.json(
      { ok: true, name: body.data.festival_name ?? "", wrappedUp: body.data.festival_wrapped_up === "true" },
      { headers: { ...CORS, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return Response.json({ ok: false }, { status: 502, headers: CORS });
  }
}
