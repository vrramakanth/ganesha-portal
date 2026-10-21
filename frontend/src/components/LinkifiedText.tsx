import YouTubeEmbed from "@/components/YouTubeEmbed";
import { youTubeId } from "@/lib/youtube";

/** Renders plain text with any http(s) URLs turned into real clickable
 *  links — announcement messages are free text a volunteer types in
 *  Volunteer > Announcements, so a URL pasted in there (e.g. a form
 *  link, a WhatsApp group invite) previously just sat there as inert
 *  text. Trailing sentence punctuation (a period, comma, closing
 *  paren) right after a URL is kept as plain text rather than being
 *  swept into the link.
 *
 *  A YouTube link also plays right where it sits (tap to play), so a
 *  volunteer can show a video anywhere this text appears just by pasting
 *  its link — several links give several videos. Pass embedVideos={false}
 *  where the text is clipped, and the link stays a plain link there. */
export default function LinkifiedText({ text, embedVideos = true }: { text: string; embedVideos?: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;

        const match = part.match(/^(.*?)([.,;:!?)\]}'"]*)$/);
        const url = match ? match[1] : part;
        const trailing = match ? match[2] : "";
        const videoId = embedVideos ? youTubeId(url) : null;
        return (
          <span key={i}>
            {videoId && (
              <span className="my-2 block">
                <YouTubeEmbed id={videoId} />
              </span>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-words text-maroon">
              {videoId ? "Watch on YouTube" : url}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
