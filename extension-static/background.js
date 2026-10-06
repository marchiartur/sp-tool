// Owns the queue writes that come from fut.gg and decides which ONE Web App tab
// opens the search (so two open Web App tabs never both search).
const DEV = false; // build-extension.mjs --dev flips this on: see the debug log below
const WEB_APP_URL = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/";
const WEB_APP_MATCH = "https://www.ea.com/*ultimate-team/web-app*";
const EMPTY = { team: "", players: [], index: 0, done: [] };

const log = (...a) => console.info("[fut.gg extension]", ...a);

// ---------- debug log (dev builds only) ----------
// Every script sends its events here; they're kept in storage.session (survives this
// worker sleeping, cleared when the browser closes) and shown live on debug.html.
const LOG_MAX = 1000;
let logBuf = null;
let logLoad = null;
let logFlush = 0;
async function debug(source, event, data, tab) {
  if (!DEV) return;
  logLoad ??= chrome.storage.session.get("debugLog").then(({ debugLog }) => (logBuf = debugLog || []));
  await logLoad;
  logBuf.push({ t: Date.now(), source, event, data, tab });
  if (logBuf.length > LOG_MAX) logBuf.splice(0, logBuf.length - LOG_MAX);
  clearTimeout(logFlush);
  logFlush = setTimeout(() => chrome.storage.session.set({ debugLog: logBuf }), 50);
}
const tabInfo = (sender) => sender?.tab && { id: sender.tab.id, url: sender.tab.url };

if (DEV) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes.debugLog && !changes.debugLog.newValue) logBuf = []; // cleared from debug.html
    if (area !== "local" || !changes.queue) return;
    const q = changes.queue.newValue;
    debug("background", "queue saved", q ? { team: q.team, players: q.players.length, index: q.index, current: q.players[q.index]?.name, done: q.done.length } : "cleared");
  });
  self.addEventListener("error", (e) => debug("background", "error", String(e.message)));
  self.addEventListener("unhandledrejection", (e) => debug("background", "error", String(e.reason?.message || e.reason)));
  debug("background", "worker started");
}

// Handlers read the queue, await, then write it back: run them one at a time
// so fast Shift+clicks can't overwrite each other's players.
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (DEV && msg?.type === "DEBUG_EVENT") return void debug(msg.source, msg.event, msg.data, tabInfo(sender));
  const handlers = { SEND_PLAYER: sendPlayer, QUEUE_TEAM: queueTeam, PANEL_READY: panelReady };
  if (DEV) handlers.DEBUG_OPEN_CURRENT = () => openInWebApp();
  const handler = handlers[msg?.type];
  if (!handler) return;
  const started = Date.now();
  serial(() => handler(msg, sender))
    .then((res) => {
      debug("background", `${msg.type} ok`, { ms: Date.now() - started, request: msg, result: res }, tabInfo(sender));
      reply({ ok: true, ...res });
    })
    .catch((err) => {
      log(msg.type, "failed", err);
      debug("background", `${msg.type} failed`, { ms: Date.now() - started, request: msg, error: String(err?.message || err) }, tabInfo(sender));
      reply({ ok: false, error: String(err?.message || err) });
    });
  return true;
});

async function getQueue() {
  const { queue } = await chrome.storage.local.get("queue");
  return queue || EMPTY;
}

// One player from a card. Click: becomes the current player. Shift+click: added to the end.
async function sendPlayer({ player, team, focus }) {
  const q = await getQueue();
  const players = [...q.players];
  let i = players.findIndex((p) => p.defId === player.defId);
  if (i === -1) {
    i = focus && players.length ? q.index + 1 : players.length;
    players.splice(i, 0, player);
  } else {
    players[i] = { ...players[i], ...player, maxBuy: undefined }; // fresh price resets edits
  }
  const index = focus ? i : Math.min(q.index, players.length - 1);
  const startsNewQueue = q.players.length === 0;
  await chrome.storage.local.set({
    queue: { ...q, team: startsNewQueue ? team || "Queue" : q.team, players, index, done: startsNewQueue ? [] : q.done },
  });
  if (focus) await openInWebApp();
  return {};
}

// Whole gallery page: replaces the queue and opens the first player.
async function queueTeam({ team, players }) {
  if (!players?.length) throw new Error("no players");
  await chrome.storage.local.set({ queue: { team, players, index: 0, done: [] } });
  await openInWebApp();
  return { count: players.length };
}

async function openInWebApp() {
  const tabs = await chrome.tabs.query({ url: WEB_APP_MATCH });
  if (!tabs.length) {
    const tab = await chrome.tabs.create({ url: WEB_APP_URL });
    await chrome.storage.session.set({ pendingTabId: tab.id });
    debug("background", "no Web App tab: opened one, search waits for its panel", { tabId: tab.id });
    return;
  }
  // The most recently used Web App tab is the one we open in.
  const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  debug("background", "picked Web App tab", { tabId: tab.id, of: tabs.map((t) => t.id) });
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "OPEN_CURRENT" });
  } catch (err) {
    // The panel isn't loaded in that tab yet (still loading or needs a refresh).
    await chrome.storage.session.set({ pendingTabId: tab.id });
    debug("background", "panel not reachable: search waits for PANEL_READY", { tabId: tab.id, error: String(err?.message || err) });
  }
}

// A panel finished loading: if we were waiting on that tab, tell it to open.
async function panelReady(_msg, sender) {
  const { pendingTabId } = await chrome.storage.session.get("pendingTabId");
  if (pendingTabId != null && pendingTabId === sender.tab?.id) {
    await chrome.storage.session.remove("pendingTabId");
    return { openCurrent: true };
  }
  return { openCurrent: false };
}
