/** The photo-album button, the same look as on Home. `label` is what it says:
 *  "Magic Moments" on Home, "Memories" on an event page. */
export default function MagicMomentsButton({ url, label = "Magic Moments" }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — view and add your photos`}
      className="relative mx-auto inline-flex items-center gap-1.5 rounded-full bg-saffron pl-3 pr-4 py-2.5 text-on-saffron shadow-sm active:bg-saffron-dark transition-colors"
    >
      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-white">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
          <path d="M10 1.2 12.3 7l6.2.5-4.7 4 1.4 6-5.2-3.1L4.8 17.5l1.4-6-4.7-4L7.7 7 10 1.2Z" />
        </svg>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      <span className="text-sm font-bold">{label}</span>
      <span className="text-xs font-medium opacity-80">· view &amp; add photos</span>
    </a>
  );
}
