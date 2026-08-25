"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

/** Scrolling belt of active announcements (spec §30) — same saffron
 *  treatment as SystemUnderTestBanner, but marqueed since volunteers may
 *  publish longer updates than fit on one line, especially on mobile. */
export default function AnnouncementsTicker() {
  const { data } = useAsync(() => api.announcements.list(), []);

  const text = (data ?? []).map((a) => `${a.title} — ${a.message}`).join("     •     ");
  if (!text) return null;

  // Roughly constant reading speed regardless of how much text there is.
  const duration = Math.max(15, text.length / 8);

  return (
    <div className="overflow-hidden whitespace-nowrap bg-saffron py-1.5" aria-live="polite">
      <div className="inline-flex animate-marquee" style={{ animationDuration: `${duration}s` }}>
        <span className="px-4 text-xs font-semibold text-white">{text}</span>
        <span className="px-4 text-xs font-semibold text-white" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
}
