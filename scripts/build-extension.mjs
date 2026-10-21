// Builds the Chrome extension into ./extension: one vite pass per bundled script
// (panel, fut.gg, popup), rem converted to px in the panel, then the static files,
// the fonts and, in dev builds, the debugger page copied in.
// `--dev` (or buildExtension({ dev: true })) builds into ./extension-dev instead, with the
// debug log turned on in every script and the debugger page (extension-debug/) added.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// vite's own binary, run with node. `npx vite` would cost about a second of lookup on
// every pass, which `pnpm dev:ext` pays on every save.
const VITE = path.join(path.dirname(createRequire(import.meta.url).resolve("vite/package.json")), "bin/vite.js");

// The scripts vite bundles from src/, each the output file of one SP_ENTRY (the same list
// as ENTRIES in vite.ext.config.ts). They get their dev flag from __SP_DEV__ at build
// time, so the string swap below skips them.
const BUNDLED = { panel: "panel.js", futgg: "futgg.js", popup: "popup.js" };

export function buildExtension({ dev = false, quiet = false } = {}) {
  const OUT = dev ? "extension-dev" : "extension";
  const BUILD = dev ? "ext-build-dev" : "ext-build";

  // One vite pass per bundled script: lib mode builds a single entry at a time, and the
  // config leaves the directory alone, so no pass wipes the ones before it.
  rmSync(BUILD, { recursive: true, force: true });
  for (const entry of Object.keys(BUNDLED))
    execSync(`node "${VITE}" build -c vite.ext.config.ts`, {
      stdio: quiet ? "pipe" : "inherit",
      env: { ...process.env, SP_DEV: dev ? "1" : "", SP_ENTRY: entry },
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
  for (const file of Object.values(BUNDLED)) if (file !== "panel.js") cpSync(`${BUILD}/${file}`, `${OUT}/${file}`);

  const fonts = {
    "chakra-petch": [500, 600, 700],
    figtree: [400, 500, 600, 700],
  };
  for (const [family, weights] of Object.entries(fonts))
    for (const w of weights)
      cpSync(`node_modules/@fontsource/${family}/files/${family}-latin-${w}-normal.woff2`, `${OUT}/fonts/${family}-${w}.woff2`);

  if (dev) {
    // The hand-written scripts each start with `const DEV = false;`: flip it on.
    const bundled = new Set(Object.values(BUNDLED));
    for (const file of readdirSync(OUT).filter((f) => f.endsWith(".js") && !bundled.has(f))) {
      const path = `${OUT}/${file}`;
      writeFileSync(path, readFileSync(path, "utf8").replace("const DEV = false;", "const DEV = true;"));
    }
    cpSync("extension-debug", OUT, { recursive: true });
  }

  // Anything built on this machine is labelled, so an unpacked copy is easy to tell from
  // the Chrome Web Store one in chrome://extensions and in the toolbar. The release zip
  // is built by GitHub Actions, which sets CI, so it keeps the plain name.
  const label = dev ? "dev" : process.env.CI ? "" : "local";
  if (label) {
    const manifest = JSON.parse(readFileSync(`${OUT}/manifest.json`, "utf8"));
    manifest.name += ` (${label})`;
    manifest.version_name = `${manifest.version} ${label} ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
  }

  if (!quiet) console.log(`\nExtension ready in ./${OUT}`);
  return OUT;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) buildExtension({ dev: process.argv.includes("--dev") });
