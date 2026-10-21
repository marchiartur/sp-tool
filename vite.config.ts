import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The website: landing page, changelog, privacy policy, and the panel preview (dev only, not linked).
// Relative base so it works under GitHub Pages' /sp-tool/ path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(import.meta.dirname, "index.html"),
        changelog: path.resolve(import.meta.dirname, "changelog.html"),
        privacy: path.resolve(import.meta.dirname, "privacy.html"),
        preview: path.resolve(import.meta.dirname, "preview.html"),
      },
    },
  },
  test: {
    // Each test file picks its own environment with a @vitest-environment docblock.
    setupFiles: ["./src/test-setup.ts"],
  },
});
