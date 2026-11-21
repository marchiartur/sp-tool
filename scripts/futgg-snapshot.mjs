// Renders live fut.gg pages to ./futgg-snapshots, for src/futgg/live.test.ts to read
// the real site with the real selectors.
//
// fut.gg builds the part we care about in the browser: a plain fetch of a gallery page
// returns the "Add players" pool but not the set's own lineup, so setCards() reads zero
// and the canary would cry drift every day. So each page is loaded in headless Chrome,
// driven over its DevTools protocol, and saved as the DOM a content script would find.
// That needs no npm dependency: the GitHub runner ships Chrome, so does any machine this
// extension is developed on, and Node 22 has the WebSocket the protocol speaks over.
//
//   node scripts/futgg-snapshot.mjs          render every page
//   node scripts/futgg-snapshot.mjs --keep    don't clear old snapshots first
//
// Settling. fut.gg fetches a gallery set's "Add players" pool and its prices only after
// the page has loaded, and marks what is still coming aria-busy. Chrome's --dump-dom
// prints at load, so it saved placeholders whenever fut.gg was slower than the load
// event, and --virtual-time-budget, which lets a page run on, is a fake clock that stops
// while a request goes unanswered, so Chrome never printed at all. Driving Chrome instead
// lets the wait be real time: until nothing is aria-busy, for at most SETTLE_MS. A page
// that is still busy after that is saved as it is, and live.test.ts skips the checks it
// can't make on placeholders rather than reporting a change to fut.gg.
//
// Which pages: the set and the player are discovered from fut.gg's own index pages rather
// than hard-coded, because gallery sets rotate and a player can leave the game. So the
// canary fails when the selectors stop working, not when a URL goes stale.
//
// Env:
//   CHROME_PATH   the browser to render with, if it isn't somewhere obvious
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "futgg-snapshots";
const SITE = "https://www.fut.gg";
// The whole of one render, start to finish, before it counts as failed.
const RENDER_TIMEOUT_MS = 60_000;
// How long Chrome may take to start and say where its DevTools are.
const LAUNCH_TIMEOUT_MS = 30_000;
// How long to wait for the load event. One request that never answers can hold it off
// for ever, and the page is usually all there by then anyway, so past this it is read
// as it stands rather than failed.
const LOAD_TIMEOUT_MS = 30_000;
// How long a page gets, after loading, for what it marks aria-busy to arrive.
const SETTLE_MS = 20_000;
const SETTLE_POLL_MS = 500;
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

/** Why a render failed, in the one line worth putting in front of someone: a canary
 *  issue that carries Chrome's whole output is a canary issue nobody reads to the end. */
const why = (err) => (err?.message ?? String(err)).split("\n")[0].slice(0, 300);

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

const lastLine = (text) => text.trim().split("\n").at(-1)?.slice(0, 200) ?? "";

/** Rejects with `message` if `promise` hasn't settled within `ms`. */
function within(ms, promise, message) {
  let timer;
  const late = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms)));
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Starts Chrome with its DevTools on a port of its choosing, and waits to hear which. */
function launch(profile) {
  const proc = spawn(
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
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let said = "";
  const exited = new Promise((resolve) => proc.once("exit", resolve));
  const endpoint = new Promise((resolve, reject) => {
    proc.stderr.on("data", (chunk) => {
      said += chunk;
      const m = said.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.once("error", (err) => reject(new Error(`Chrome would not start: ${err.message}`)));
    proc.once("exit", (code) => reject(new Error(`Chrome exited ${code}: ${lastLine(said)}`)));
  });
  return {
    endpoint: within(LAUNCH_TIMEOUT_MS, endpoint, `Chrome did not start within ${LAUNCH_TIMEOUT_MS / 1000}s`),
    /** Stops Chrome and waits for it to go, so its profile is free to remove. */
    async stop() {
      if (proc.exitCode === null && proc.signalCode === null) proc.kill();
      await within(5_000, exited, "").catch(() => proc.kill("SIGKILL"));
    },
  };
}

/** Just enough of the DevTools protocol to load a page and read it back. */
async function devtools(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("could not connect to Chrome's DevTools"));
  });
  let next = 0;
  const waiting = new Map();
  const listeners = new Set();
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id === undefined) return listeners.forEach((listen) => listen(msg));
    const call = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) call?.reject(new Error(`Chrome refused ${call.method}: ${msg.error.message}`));
    else call?.resolve(msg.result);
  };
  return {
    send(method, params = {}, sessionId) {
      const id = ++next;
      socket.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((resolve, reject) => waiting.set(id, { resolve, reject, method }));
    },
    /** The next `method` event from the given session. */
    event(method, sessionId) {
      return new Promise((resolve) => {
        const listen = (msg) => {
          if (msg.method !== method || msg.sessionId !== sessionId) return;
          listeners.delete(listen);
          resolve(msg.params);
        };
        listeners.add(listen);
      });
    },
    close: () => socket.close(),
  };
}

/** Loads `url` in a fresh Chrome and returns its DOM: once fut.gg has nothing left
 *  aria-busy when `settle`, as soon as it has loaded otherwise. */
async function dumpDom(url, { settle = false } = {}) {
  // A throwaway profile each time, so nothing a page stored can change the next render.
  // Absolute: Chrome resolves a relative --user-data-dir against somewhere of its own
  // choosing and, on Windows, gives up with "failed to create data directory".
  const profile = mkdtempSync(path.join(tmpdir(), "futgg-snapshot-"));
  const chrome = launch(profile);
  let cdp;
  // The limit is kept here rather than by the caller so that, whatever hangs, the finally
  // below still stops this Chrome: one left running would keep the script from exiting.
  const work = async () => {
    cdp = await devtools(await chrome.endpoint);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const evaluate = async (expression) =>
      (await cdp.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId)).result.value;

    await cdp.send("Page.enable", {}, sessionId);
    const loaded = cdp.event("Page.loadEventFired", sessionId);
    const { errorText } = await cdp.send("Page.navigate", { url }, sessionId);
    if (errorText) throw new Error(`Chrome could not load it: ${errorText}`);
    if (!(await within(LOAD_TIMEOUT_MS, loaded.then(() => true), "").catch(() => false)))
      process.stdout.write(`(not loaded within ${LOAD_TIMEOUT_MS / 1000}s; reading it as it stands) `);

    if (settle) {
      const busy = () => evaluate(`!!document.querySelector('[aria-busy="true"]')`);
      const until = Date.now() + SETTLE_MS;
      while ((await busy()) && Date.now() < until) await sleep(SETTLE_POLL_MS);
      if (await busy()) process.stdout.write(`(still loading after ${SETTLE_MS / 1000}s; saving it as it is) `);
    }
    return await evaluate(`"<!DOCTYPE html>\\n" + document.documentElement.outerHTML`);
  };
  try {
    return await within(RENDER_TIMEOUT_MS, work(), `it did not finish within ${RENDER_TIMEOUT_MS / 1000}s`);
  } finally {
    cdp?.close();
    await chrome.stop();
    // Chrome can still hold files under its own profile for a moment after exiting, and
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
async function render(url, { settle = false } = {}) {
  let last;
  for (let attempt = 1; attempt <= RENDER_TRIES; attempt++) {
    if (attempt > 1) await sleep(RETRY_PAUSE_MS);
    try {
      const html = await dumpDom(url, { settle });
      if (html.length >= MIN_BYTES) return html;
      last = new Error(`it rendered only ${html.length} bytes, so it isn't the page we wanted`);
    } catch (err) {
      last = err;
    }
    if (attempt < RENDER_TRIES) process.stdout.write(`(${why(last)}; retrying) `);
  }
  throw last;
}

async function firstLink(path, matches) {
  let html;
  try {
    html = await render(`${SITE}${path}`);
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
  set: await firstLink("/fut-gallery/", (href) => SET_PATH.test(href)),
  // One player's own page: no link around his card, so he is read off the URL and the art.
  player: await firstLink("/players/", (href) => PLAYER_PATH.test(href)),
  // A plain list of players: many linked cards, the pill's commonest home.
  list: "/players/",
};

const index = {};
for (const [name, path] of Object.entries(pages)) {
  const url = `${SITE}${path}`;
  process.stdout.write(`snapshot: ${name} ${url} ... `);
  let html;
  try {
    html = await render(url, { settle: true });
  } catch (err) {
    die(`Chrome couldn't render ${url}: ${why(err)}`);
  }
  writeFileSync(`${OUT}/${name}.html`, html);
  index[name] = { url, path, bytes: html.length };
  console.log(`${html.length} bytes`);
}

writeFileSync(`${OUT}/index.json`, `${JSON.stringify({ renderedAt: new Date().toISOString(), pages: index }, null, 2)}\n`);
console.log(`snapshot: wrote ${Object.keys(index).length} pages to ./${OUT}`);
