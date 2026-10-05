import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The website: landing page, changelog, and the panel preview (dev only, not linked).
// Relative base so it works under GitHub Pages' /sp-tool/ path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        changelog: path.resolve(__dirname, "changelog.html"),
        preview: path.resolve(__dirname, "preview.html"),
      },
    },
  },
});
