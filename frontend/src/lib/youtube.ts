/** Pulls the video id out of a YouTube link, or returns null for anything
 *  else. Deliberately strict — only YouTube's own hosts, and an id of
 *  exactly the shape YouTube uses — because the id goes into an embed
 *  address, so a pasted link must never be able to point the player at
 *  another site. Handles the usual forms: watch?v=, youtu.be/, /shorts/,
 *  /embed/ and /live/ (unlisted videos use the same links). */
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youTubeId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v");
  } else {
    const [, kind, id] = url.pathname.split("/");
    if (kind === "shorts" || kind === "embed" || kind === "live" || kind === "v") candidate = id ?? null;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}
