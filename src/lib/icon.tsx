// The app icon drawn as an image, for the home screen (apple-icon.tsx and the
// pwa-icon route that manifest.ts lists). Server-only.

import { ImageResponse } from "next/og";

import { ICON_COLORS } from "./theme";

/** A square PNG `size` px wide. `maskable` keeps the mark inside the middle 60% so Android can crop it to any shape. */
export function iconImage(size: number, maskable = false): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ICON_COLORS.background,
          color: ICON_COLORS.mark,
          fontSize: size * (maskable ? 0.45 : 0.62),
          fontWeight: 700,
        }}
      >
        C
      </div>
    ),
    { width: size, height: size },
  );
}
