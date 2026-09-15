/** Renders plain text with any http(s) URLs turned into real clickable
 *  links — announcement messages are free text a volunteer types in
 *  Volunteer > Announcements, so a URL pasted in there (e.g. a form
 *  link, a WhatsApp group invite) previously just sat there as inert
 *  text. Trailing sentence punctuation (a period, comma, closing
 *  paren) right after a URL is kept as plain text rather than being
 *  swept into the link. */
export default function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;

        const match = part.match(/^(.*?)([.,;:!?)\]}'"]*)$/);
        const url = match ? match[1] : part;
        const trailing = match ? match[2] : "";
        return (
          <span key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-words text-maroon">
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
