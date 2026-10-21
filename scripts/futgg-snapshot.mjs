// Renders live fut.gg pages to ./futgg-snapshots, for src/futgg/live.test.ts to read
// the real site with the real selectors.
//
// fut.gg builds the part we care about in the browser: a plain fetch of a gallery page
// returns the "Add players" pool but not the set's own lineup, so setCards() reads zero
// and the canary would cry drift every day. Chrome's own --dump-dom with a virtual time
// budget runs the page's JavaScript and prints the DOM it ends up with, which is what a
// content script sees. That needs no npm dependency: the GitHub runner ships Chrome, and
// so does any machine this extension is developed on.
//
//   node scripts/futgg-snapshot.mjs          render every page
//   node scripts/futgg-snapshot.mjs --keep    don't clear old snapshots first
//
// Which pages: the set and the player are discovered from fut.gg's own index pages rather
// than hard-coded, because gallery sets rotate and a player can leave the game. So the
// canary fails when the selectors stop working, not when a URL goes stale.
//
// Env:
//   CHROME_PATH   the browser to render with, if it isn't somewhere obvious
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const OUT = "futgg-snapshots";
const SITE = "https://www.fut.gg";
// Long enough for fut.gg to fetch its prices, and fiction: virtual time, not wall clock.
const TIME_BUDGET_MS = 20_000;
const RENDER_TIMEOUT_MS = 90_000;
// Chrome prints a rendered page in the hundreds of kilobytes. Much less than this and it
// rendered an error page, a consent wall or a Cloudflare challenge rather than the site.
const MIN_BYTES = 50_000;

// A real browser's, because fut.gg serves a trimmed page to anything that looks automated.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const PLAYER_PATH = /^\/players\/\d+-[a-z0-9-]+\/\d{2}-\d+\/?$/i;
const SET_PATH = /^\/fut-gallery\/[^/]+\/[^/]+\/$/;

const die = (message) => {
  console.error(`snapshot: ${message}`);
  process.exit(1);
};

function chrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA ?? ""}/Google/Chrome/Application/chrome.exe`,
  ];
  const found = candidates.find((p) => p && existsSync(p));
  return found ?? die("no Chrome found; set CHROME_PATH to one");
}

const BROWSER = chrome();

/** The DOM after the page's own scripts have run, as a content script would find it.
 *  Every page goes through the browser, index pages included: fut.gg answers 403 to a
 *  bare fetch, and matching whatever it checks for would be a second thing to maintain. */
function render(url, budgetMs = TIME_BUDGET_MS) {
  // A throwaway profile each time, so nothing a page stored can change the next render.
  // Absolute: Chrome resolves a relative --user-data-dir against somewhere of its own
  // choosing and, on Windows, gives up with "failed to create data directory".
  const profile = mkdtempSync(path.join(tmpdir(), "futgg-snapshot-"));
  try {
    return execFileSync(
      BROWSER,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox", // the runner's Chrome has no sandbox available to it
        "--no-first-run",
        "--disable-extensions",
        "--hide-scrollbars",
        "--window-size=1440,2400", // wide enough that fut.gg lays out its desktop grid
        `--user-data-dir=${profile}`,
        `--user-agent=${UA}`,
        `--virtual-time-budget=${budgetMs}`,
        "--dump-dom",
        url,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: RENDER_TIMEOUT_MS, stdio: ["ignore", "pipe", "ignore"] },
    );
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

/** An index page's links are in the markup it arrives with, so this needs no price fetch
 *  to settle: a short budget is enough. */
function firstLink(path, matches) {
  const html = render(`${SITE}${path}`, 5000);
  for (const [, href] of html.matchAll(/href="(\/[^"]+)"/g)) if (matches(href)) return href;
  return die(`found no link on ${path} shaped like the one the canary needs`);
}

if (!process.argv.includes("--keep")) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const pages = {
  // A FUT Gallery set: the page the extension exists for. Its cards are the set's lineup
  // plus the "Add players" pool, which setCards() has to tell apart.
  set: firstLink("/fut-gallery/", (href) => SET_PATH.test(href)),
  // One player's own page: no link around his card, so he is read off the URL and the art.
  player: firstLink("/players/", (href) => PLAYER_PATH.test(href)),
  // A plain list of players: many linked cards, the pill's commonest home.
  list: "/players/",
};

const index = {};
for (const [name, path] of Object.entries(pages)) {
  const url = `${SITE}${path}`;
  process.stdout.write(`snapshot: ${name} ${url} ... `);
  let html;
  try {
    html = render(url);
  } catch (err) {
    die(`Chrome couldn't render ${url}: ${err.code === "ETIMEDOUT" ? "it timed out" : err.message}`);
  }
  if (html.length < MIN_BYTES) die(`${url} rendered only ${html.length} bytes, so it isn't the page we wanted`);
  writeFileSync(`${OUT}/${name}.html`, html);
  index[name] = { url, path, bytes: html.length };
  console.log(`${html.length} bytes`);
}

writeFileSync(`${OUT}/index.json`, `${JSON.stringify({ renderedAt: new Date().toISOString(), pages: index }, null, 2)}\n`);
console.log(`snapshot: wrote ${Object.keys(index).length} pages to ./${OUT}`);
