import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Three party balloons on strings, for Children's Day cards. */
function Balloons() {
  const balloons = [
    { left: 0, top: 60, color: "#ef476f" },
    { left: 110, top: 0, color: "#ffd23f" },
    { left: 220, top: 70, color: "#06d6a0" },
  ];
  return (
    <div style={{ position: "absolute", right: 90, bottom: 60, width: 320, height: 420, display: "flex" }}>
      {balloons.map((b) => (
        <div key={b.left} style={{ position: "absolute", left: b.left, top: b.top, width: 100, height: 330, display: "flex" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 100, height: 120, borderRadius: 60, background: b.color }} />
          <div style={{ position: "absolute", left: 48, top: 120, width: 4, height: 210, background: "#ffffffaa" }} />
        </div>
      ))}
    </div>
  );
}

/** A simple jack-o'-lantern drawn from boxes, for Halloween cards. */
function Pumpkin({ face }: { face: string }) {
  return (
    <div style={{ position: "absolute", right: 80, bottom: 70, width: 300, height: 290, display: "flex" }}>
      <div style={{ position: "absolute", left: 130, top: 0, width: 40, height: 60, background: "#3b7d23", borderRadius: 10 }} />
      <div style={{ position: "absolute", left: 0, top: 40, width: 300, height: 250, background: "#ff7a00", borderRadius: 150 }} />
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 110,
          width: 0,
          height: 0,
          borderLeft: "28px solid transparent",
          borderRight: "28px solid transparent",
          borderBottom: `50px solid ${face}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 174,
          top: 110,
          width: 0,
          height: 0,
          borderLeft: "28px solid transparent",
          borderRight: "28px solid transparent",
          borderBottom: `50px solid ${face}`,
        }}
      />
      <div style={{ position: "absolute", left: 80, top: 190, width: 140, height: 60, background: face, borderRadius: "0 0 70px 70px" }} />
    </div>
  );
}

type Card = {
  primary: string;
  accent: string;
  eyebrow: string;
  title: string;
  lines?: string[];
  decor?: "pumpkin" | "balloons";
};

/** The shared link-card image: festival colours, a small heading, a big
 *  title and a couple of detail lines. Flexbox only — that is all
 *  ImageResponse supports. */
export function ogCard({ primary, accent, eyebrow, title, lines = [], decor }: Card) {
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
          position: "relative",
        }}
      >
        {decor === "pumpkin" && <Pumpkin face={primary} />}
        {decor === "balloons" && <Balloons />}
        <div style={{ display: "flex", fontSize: 34, letterSpacing: 2, color: accent, textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column", ...(decor ? { maxWidth: 700 } : {}) }}>
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
