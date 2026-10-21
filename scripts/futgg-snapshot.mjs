// Renders live fut.gg pages to ./futgg-snapshots, for src/futgg/live.test.ts to read
// the real site with the real selectors.
//
// fut.gg builds the part we care about in the browser: a plain fetch of a gallery page
// returns the "Add players" pool but not the set's own lineup, so setCards() reads zero
// and the canary would cry drift every day. Chrome's own --dump-dom runs the page's
// JavaScript and prints the DOM it ends up with once the page has loaded, which is what
// a content script sees. That needs no npm dependency: the GitHub runner ships Chrome,
// and so does any machine this extension is developed on.
//
//   node scripts/futgg-snapshot.mjs          render every page
//   node scripts/futgg-snapshot.mjs --keep    don't clear old snapshots first
//
// Not --virtual-time-budget, which this used to pass to settle fut.gg's price fetch: that
// budget is a fake clock, and it stops advancing while the page waits on a request that
// never answers. Chrome then never prints and never exits, and a canary that cannot
// render says "fut.gg changed" when all that happened was an unlucky minute.
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
const RENDER_TIMEOUT_MS = 60_000;
// A render is a page off the live internet, so one bad one is not news. Two in a row is.
const RENDER_TRIES = 2;
const RETRY_PAUSE_MS = 2_000;
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

/** Chrome's own failure, in the one line worth putting in front of someone. Chrome says
 *  little on the way out and says it on stderr, so the tail of that goes in too: without
 *  it a failed render reaches the canary's issue as no information at all. */
function why(err) {
  if (err.code === "ETIMEDOUT" || err.signal === "SIGTERM") return `it did not finish within ${RENDER_TIMEOUT_MS / 1000}s`;
  const said = (err.stderr ?? "").trim().split("\n").at(-1)?.slice(0, 200);
  return said ? `${err.message ?? err} (Chrome said: ${said})` : (err.message ?? String(err));
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

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

function dumpDom(url) {
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
        "--dump-dom",
        url,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: RENDER_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
    );
  } finally {
    // Chrome can still hold files under its own profile for a moment after printing, and
    // on Windows that makes removing it throw. A temp directory left behind is not worth
    // failing a render over.
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }
}

/** The DOM after the page's own scripts have run, as a content script would find it.
 *  Every page goes through the browser, index pages included: fut.gg answers 403 to a
 *  bare fetch, and matching whatever it checks for would be a second thing to maintain. */
function render(url) {
  let last;
  for (let attempt = 1; attempt <= RENDER_TRIES; attempt++) {
    if (attempt > 1) sleep(RETRY_PAUSE_MS);
    try {
      const html = dumpDom(url);
      if (html.length >= MIN_BYTES) return html;
      last = new Error(`it rendered only ${html.length} bytes, so it isn't the page we wanted`);
    } catch (err) {
      last = err;
    }
    if (attempt < RENDER_TRIES) process.stdout.write(`(${why(last)}; retrying) `);
  }
  throw last;
}

function firstLink(path, matches) {
  let html;
  try {
    html = render(`${SITE}${path}`);
  } catch (err) {
    return die(`Chrome couldn't render ${SITE}${path}, so no page could be found to snapshot: ${why(err)}`);
  }
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
    die(`Chrome couldn't render ${url}: ${why(err)}`);
  }
  writeFileSync(`${OUT}/${name}.html`, html);
  index[name] = { url, path, bytes: html.length };
  console.log(`${html.length} bytes`);
}

writeFileSync(`${OUT}/index.json`, `${JSON.stringify({ renderedAt: new Date().toISOString(), pages: index }, null, 2)}\n`);
console.log(`snapshot: wrote ${Object.keys(index).length} pages to ./${OUT}`);
