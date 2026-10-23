import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

type Card = {
  primary: string;
  accent: string;
  eyebrow: string;
  title: string;
  lines?: string[];
};

/** The shared link-card image: festival colours, a small heading, a big
 *  title and a couple of detail lines. Flexbox only — that is all
 *  ImageResponse supports. */
export function ogCard({ primary, accent, eyebrow, title, lines = [] }: Card) {
  const size = title.length > 60 ? 56 : title.length > 32 ? 72 : 92;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: primary,
          color: "white",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, letterSpacing: 2, color: accent, textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          {lines.filter(Boolean).map((line) => (
            <div key={line} style={{ display: "flex", fontSize: 38, marginTop: 20, opacity: 0.92 }}>
              {line}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 14, width: 220, background: accent, borderRadius: 7 }} />
      </div>
    ),
    OG_SIZE
  );
}
