// Builds the Chrome extension into ./extension:
// panel (React) -> rem converted to px -> static files + fonts copied.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = "extension";
execSync("npx vite build -c vite.ext.config.ts", { stdio: "inherit" });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/fonts`, { recursive: true });
cpSync("extension-static", OUT, { recursive: true });

// EA's page sets its own root font-size; px keeps the panel the same size everywhere.
const js = readFileSync("ext-build/panel.js", "utf8").replace(
  /(?<![\w.])(-?\d*\.?\d+)rem\b/g,
  (_, n) => `${parseFloat(n) * 16}px`,
);
writeFileSync(`${OUT}/panel.js`, js);

const fonts = {
  "chakra-petch": [500, 600, 700],
  figtree: [400, 500, 600, 700],
};
for (const [family, weights] of Object.entries(fonts))
  for (const w of weights)
    cpSync(`node_modules/@fontsource/${family}/files/${family}-latin-${w}-normal.woff2`, `${OUT}/fonts/${family}-${w}.woff2`);

console.log(`\nExtension ready in ./${OUT}`);
