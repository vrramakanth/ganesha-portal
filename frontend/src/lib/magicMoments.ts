/** An event's photo album ("Magic Moments") link lives in its description, on
 *  a line of its own that mentions "Magic Moments" or "Memories" and contains
 *  the link:
 *
 *      Magic Moments: https://photos.app.goo.gl/…
 *
 *  The page shows that line as the Magic Moments button instead of as text.
 *  The line can carry an emoji or bold/markdown marks around the words
 *  (📸 **Magic Moments:** https://…); only web (http/https) links are
 *  accepted. */
const MENTION = /magic\s*moments|memories/i;
const URL = /https?:\/\/[^\s<>"')\]*]+/i;

export function splitMagicMoments(description: string): { text: string; url: string | null } {
  const lines = description.split("\n");
  const index = lines.findIndex((line) => MENTION.test(line) && URL.test(line));
  if (index === -1) return { text: description, url: null };
  const url = lines[index].match(URL)![0].replace(/[.,;:!?]+$/, "");
  lines.splice(index, 1);
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), url };
}
