// `pnpm dev:ext`: one command to start testing the extension.
// 1. Builds a dev copy into ./extension-dev (debug log on, debugger page added).
// 2. Opens Brave/Chrome/Edge with its own profile in ./.dev-profile (your EA login stays there
//    between runs; your normal browser profile is never touched) and loads the dev extension.
// 3. Opens the debugger, a fut.gg gallery and the Web App.
// 4. Watches the source: on every save it rebuilds, reloads the extension and refreshes the
//    fut.gg / Web App / debugger tabs (old content scripts stop working after a reload).
// Pick a browser with SP_BROWSER="C:\path\to\browser.exe". Ctrl+C closes everything.
import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import path from "node:path";
import { buildExtension } from "./build-extension.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
process.chdir(ROOT);
const PROFILE = path.join(ROOT, ".dev-profile");
const START_URLS = ["https://www.fut.gg/fut-gallery/", "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/"];
const RELOAD_MATCH = /^https:\/\/www\.fut\.gg\/|^https:\/\/www\.ea\.com\/.*ultimate-team\/web-app/;
const WATCH = ["src", "extension-static", "extension-debug"];
const IGNORE = /(^|[\\/])(site|.*\.test\.ts$)/; // website-only files don't affect the extension

const say = (...a) => console.log(`\x1b[36m[dev:ext]\x1b[0m`, ...a);

function findBrowser() {
  if (process.env.SP_BROWSER) return process.env.SP_BROWSER;
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  const candidates =
    process.platform === "win32"
      ? [
          `${pf}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
          `${local}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
          `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
          `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
          `${local}\\Google\\Chrome\\Application\\chrome.exe`,
          `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          ]
        : ["/usr/bin/brave-browser", "/usr/bin/google-chrome", "/usr/bin/chromium"];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("No Brave/Chrome/Edge found. Set SP_BROWSER to the browser's executable.");
  return found;
}

// ---------- DevTools protocol over a pipe ----------
// --remote-debugging-pipe is what lets us load an unpacked extension
// (Extensions.loadUnpacked); recent Chrome ignores --load-extension.
function connect(browser) {
  const [, , , toBrowser, fromBrowser] = browser.stdio;
  let buf = "";
  let nextId = 0;
  const pending = new Map();
  fromBrowser.on("data", (chunk) => {
    buf += chunk;
    for (let i; (i = buf.indexOf("\0")) >= 0; ) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      const p = msg.id && pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(`${p.method}: ${msg.error.message}`)) : p.resolve(msg.result);
    }
  });
  fromBrowser.on("error", () => {});
  toBrowser.on("error", () => {});
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject, method });
      toBrowser.write(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }) + "\0");
    });
}

// ---------- start ----------
const exe = findBrowser();
say("building the dev extension…");
const OUT = path.join(ROOT, buildExtension({ dev: true, quiet: true }));

say(`opening ${path.basename(exe)} with the dev profile in .dev-profile/`);
const browser = spawn(
  exe,
  [
    `--user-data-dir=${PROFILE}`,
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "--no-first-run",
    "--no-default-browser-check",
  ],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
);
browser.on("exit", () => {
  say("browser closed, bye");
  process.exit(0);
});
const cdp = connect(browser);

const load = async () => (await cdp("Extensions.loadUnpacked", { path: OUT })).id;
const pages = async () => (await cdp("Target.getTargets")).targetInfos.filter((t) => t.type === "page");

const extId = await load();
const DEBUG_URL = `chrome-extension://${extId}/debug.html`;
const open = await pages();
for (const url of [DEBUG_URL, ...START_URLS])
  if (!open.some((t) => t.url.startsWith(url))) await cdp("Target.createTarget", { url });

say(`ready. Extension id ${extId}`);
say(`debugger: ${DEBUG_URL}`);
say("watching src/, extension-static/, extension-debug/ — save a file to rebuild and reload. Ctrl+C to quit.");

// ---------- rebuild on save ----------
async function reloadTabs() {
  for (const t of await pages()) {
    if (!RELOAD_MATCH.test(t.url) && !t.url.startsWith(DEBUG_URL)) continue;
    const { sessionId } = await cdp("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    await cdp("Page.reload", {}, sessionId).catch(() => {});
    await cdp("Target.detachFromTarget", { sessionId }).catch(() => {});
  }
}

let timer = 0;
let building = false;
let again = false;
async function rebuild(changed) {
  if (building) return void (again = true);
  building = true;
  const started = Date.now();
  try {
    buildExtension({ dev: true, quiet: true });
    await load(); // loading the same folder again reloads it
    await reloadTabs();
    say(`rebuilt and reloaded in ${Date.now() - started}ms (${changed})`);
  } catch (err) {
    say(`\x1b[31mbuild failed\x1b[0m (${changed}):\n${err.stderr?.toString() || err.stdout?.toString() || err.message}`);
  }
  building = false;
  if (again) {
    again = false;
    rebuild("more changes");
  }
}

for (const dir of WATCH)
  watch(dir, { recursive: true }, (_event, file) => {
    if (!file || IGNORE.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(path.join(dir, file)), 300);
  });

process.on("SIGINT", () => {
  cdp("Browser.close").catch(() => browser.kill());
  setTimeout(() => process.exit(0), 3000);
});
