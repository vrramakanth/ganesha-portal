import { ImageResponse } from "next/og";
import { festivalPreview } from "@/lib/festivalPreview";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The tab/home-screen icon: the festival's initial on its colours, in place
 *  of the default framework icon. */
export default async function Icon() {
  const festival = await festivalPreview();
  const initial = (festival?.name ?? "Namma Habba").trim().charAt(0).toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: festival?.primary ?? "#7a1330",
          color: festival?.accent ?? "#f4791f",
          fontSize: 44,
          fontWeight: 700,
          borderRadius: 14,
        }}
      >
        {initial}
      </div>
    ),
    size
  );
}
