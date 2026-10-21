import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds one of the extension's bundled scripts as a single classic script.
// SP_ENTRY picks which (build-extension.mjs runs this config once per entry); it clears
// the output directory itself, so neither run empties the other's work.
// SP_DEV=1 (set by `build-extension.mjs --dev`) turns on the debug log and keeps the output readable.
const dev = process.env.SP_DEV === "1";

const ENTRIES = {
  panel: { entry: "src/extension/panel-entry.tsx", name: "FutggPanel", file: "panel.js" },
  futgg: { entry: "src/futgg/index.ts", name: "FutggPage", file: "futgg.js" },
  popup: { entry: "src/popup/index.ts", name: "FutggPopup", file: "popup.js" },
};

// Keep this list and BUNDLED in build-extension.mjs in step: an entry one of them doesn't
// know about should stop the build rather than quietly build the wrong script.
const name = process.env.SP_ENTRY ?? "panel";
const target: (typeof ENTRIES)[keyof typeof ENTRIES] | undefined = ENTRIES[name as keyof typeof ENTRIES];
if (!target) throw new Error(`SP_ENTRY must be one of ${Object.keys(ENTRIES).join(", ")}, not "${name}"`);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  define: { "process.env.NODE_ENV": '"production"', __SP_DEV__: JSON.stringify(dev) },
  publicDir: false, // public/ belongs to the website; the extension's static files are copied by build-extension.mjs
  build: {
    outDir: dev ? "ext-build-dev" : "ext-build",
    emptyOutDir: false,
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    lib: {
      entry: target.entry,
      formats: ["iife"],
      name: target.name,
      fileName: () => target.file,
    },
  },
});
