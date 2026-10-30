import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Revisiting a page within 5 minutes reuses what was loaded; the layout's RefreshOnReturn and
    // every server action's refresh() keep it from going stale.
    staleTimes: { dynamic: 300 },
    // A failed navigation or action waits for the connection instead of erroring (Offline banner).
    useOffline: true,
  },
  async headers() {
    // A new service worker must reach phones at once, never from a cache.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
