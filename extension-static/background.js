// Owns the queue writes that come from fut.gg and decides which ONE Web App tab
// opens the search (so two open Web App tabs never both search).
const WEB_APP_URL = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/";
const WEB_APP_MATCH = "https://www.ea.com/*ultimate-team/web-app*";
const EMPTY = { team: "", players: [], index: 0, done: [] };

const log = (...a) => console.info("[fut.gg extension]", ...a);

// Handlers read the queue, await, then write it back: run them one at a time
// so fast Shift+clicks can't overwrite each other's players.
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handlers = { SEND_PLAYER: sendPlayer, QUEUE_TEAM: queueTeam, PANEL_READY: panelReady };
  const handler = handlers[msg?.type];
  if (!handler) return;
  serial(() => handler(msg, sender))
    .then((res) => reply({ ok: true, ...res }))
    .catch((err) => {
      log(msg.type, "failed", err);
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
    return;
  }
  // The most recently used Web App tab is the one we open in.
  const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "OPEN_CURRENT" });
  } catch {
    // The panel isn't loaded in that tab yet (still loading or needs a refresh).
    await chrome.storage.session.set({ pendingTabId: tab.id });
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
