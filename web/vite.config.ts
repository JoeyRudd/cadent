import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Strip /api like Caddy's handle_path, so dev and production call the same paths.
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", rewrite: (path) => path.replace(/^\/api/, "") },
    },
  },
  test: { environment: "jsdom" },
});
