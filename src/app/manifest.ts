import type { MetadataRoute } from "next";

import { BAR_COLORS } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cadent",
    short_name: "Cadent",
    description: "Today's run, this week against the plan, and a safety check on the plan.",
    start_url: "/",
    display: "standalone",
    background_color: BAR_COLORS.light,
    theme_color: BAR_COLORS.light,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
