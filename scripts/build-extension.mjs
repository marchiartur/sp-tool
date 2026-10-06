// Builds the Chrome extension into ./extension:
// panel (React) -> rem converted to px -> static files + fonts copied.
// `--dev` (or buildExtension({ dev: true })) builds into ./extension-dev instead, with the
// debug log turned on in every script and the debugger page (extension-debug/) added.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function buildExtension({ dev = false, quiet = false } = {}) {
  const OUT = dev ? "extension-dev" : "extension";
  const BUILD = dev ? "ext-build-dev" : "ext-build";
  execSync("npx vite build -c vite.ext.config.ts", {
    stdio: quiet ? "pipe" : "inherit",
    env: { ...process.env, SP_DEV: dev ? "1" : "" },
  });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/fonts`, { recursive: true });
  cpSync("extension-static", OUT, { recursive: true });

  // EA's page sets its own root font-size; px keeps the panel the same size everywhere.
  const js = readFileSync(`${BUILD}/panel.js`, "utf8").replace(
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

  if (dev) {
    // The plain scripts each start with `const DEV = false;`: flip it on.
    for (const file of readdirSync(OUT).filter((f) => f.endsWith(".js") && f !== "panel.js")) {
      const path = `${OUT}/${file}`;
      writeFileSync(path, readFileSync(path, "utf8").replace("const DEV = false;", "const DEV = true;"));
    }
    cpSync("extension-debug", OUT, { recursive: true });
    const manifest = JSON.parse(readFileSync(`${OUT}/manifest.json`, "utf8"));
    manifest.name += " (dev)";
    manifest.version_name = `${manifest.version} dev ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
  }

  if (!quiet) console.log(`\nExtension ready in ./${OUT}`);
  return OUT;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) buildExtension({ dev: process.argv.includes("--dev") });
