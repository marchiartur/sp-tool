import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds the panel as a single classic script for the extension's content_scripts.
// SP_DEV=1 (set by `build-extension.mjs --dev`) turns on the debug log and keeps the output readable.
const dev = process.env.SP_DEV === "1";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  define: { "process.env.NODE_ENV": '"production"', __SP_DEV__: JSON.stringify(dev) },
  build: {
    outDir: dev ? "ext-build-dev" : "ext-build",
    emptyOutDir: true,
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    lib: {
      entry: "src/extension/panel-entry.tsx",
      formats: ["iife"],
      name: "FutggPanel",
      fileName: () => "panel.js",
    },
  },
});
