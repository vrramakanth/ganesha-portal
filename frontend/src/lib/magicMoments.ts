/** An event's photo album ("Magic Moments") link lives in its description, on
 *  a line of its own:
 *
 *      Magic Moments: https://photos.app.goo.gl/…
 *
 *  The page shows that line as the Magic Moments button instead of as text.
 *  Only web (http/https) links are accepted. */
const LINE = /^[ \t]*magic moments[ \t]*[:\-–][ \t]*(https?:\/\/\S+)[ \t]*$/im;

export function splitMagicMoments(description: string): { text: string; url: string | null } {
  const match = description.match(LINE);
  if (!match) return { text: description, url: null };
  return { text: description.replace(LINE, "").replace(/\n{3,}/g, "\n\n").trim(), url: match[1] };
}
