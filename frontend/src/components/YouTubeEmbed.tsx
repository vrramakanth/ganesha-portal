"use client";

import { useState } from "react";

/** A YouTube video that costs nothing until it is tapped: it shows the
 *  video's thumbnail with a play button, and only loads YouTube's player
 *  once someone presses play. That keeps pages light on mobile data (a
 *  page with several videos loads several images, not several players).
 *  Uses the privacy-enhanced host, and plays inline on phones. */
export default function YouTubeEmbed({ id, title = "Video" }: { id: string; title?: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <span className="block overflow-hidden rounded-xl border border-border bg-black">
      <span className="relative block aspect-video w-full">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-active:bg-black/35">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-maroon shadow">
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-7 w-7" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </span>
    </span>
  );
}
