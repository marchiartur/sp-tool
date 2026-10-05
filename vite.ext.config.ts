import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds the panel as a single classic script for the extension's content_scripts.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "ext-build",
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: "src/extension/panel-entry.tsx",
      formats: ["iife"],
      name: "FutggPanel",
      fileName: () => "panel.js",
    },
  },
});
