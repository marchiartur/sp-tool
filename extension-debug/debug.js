// SP Tool 27 debugger: live event log from every script, queue editor, tabs and storage.
// Only in dev builds (`pnpm dev:ext`); the release zip never includes this page.
const $ = (id) => document.getElementById(id);
const manifest = chrome.runtime.getManifest();
const SOURCES = ["background", "fut.gg", "panel", "ea-main", "debugger"];
const BAD = /fail|error|timed out|broken|loggedOut|not reachable/i;
const WARN = /deferred|waits|offline|NOT FOUND|withoutPrice":\s*[1-9]/i;

let log = [];
let shown = new Set(SOURCES);
const opened = new Set(); // expanded rows, by timestamp+event

$("version").textContent = `${manifest.version_name || manifest.version} · ${chrome.runtime.id}`;

// ---------- event log ----------
for (const s of SOURCES) {
  const label = document.createElement("label");
  label.innerHTML = `<input type="checkbox" checked /> <span class="src src-${s}">${s}</span>`;
  label.querySelector("input").addEventListener("change", (e) => {
    if (e.target.checked) shown.add(s);
    else shown.delete(s);
    render();
  });
  $("sources").appendChild(label);
}

const time = (t) => new Date(t).toTimeString().slice(0, 8) + "." + String(t % 1000).padStart(3, "0");
const text = (data) => (data === undefined ? "" : typeof data === "string" ? data : JSON.stringify(data, null, 2));
const key = (e) => `${e.t}|${e.source}|${e.event}`;

function render() {
  const q = $("search").value.toLowerCase();
  const errorsOnly = $("errorsOnly").checked;
  const rows = log.filter((e) => {
    if (!shown.has(e.source)) return false;
    const all = `${e.event} ${text(e.data)}`;
    if (errorsOnly && !BAD.test(all)) return false;
    return !q || all.toLowerCase().includes(q);
  });
  $("count").textContent = `${rows.length} of ${log.length}`;
  const box = $("events");
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.replaceChildren(
    ...rows.map((e, i) => {
      const row = document.createElement("div");
      const all = `${e.event} ${text(e.data)}`;
      row.className = `ev${BAD.test(all) ? " bad" : WARN.test(all) ? " warn" : ""}${opened.has(key(e)) ? " open" : ""}`;
      const prev = rows[i - 1];
      const delta = prev ? e.t - prev.t : 0;
      row.innerHTML = `<span class="t"></span><span class="d"></span><span class="src src-${e.source}"></span><span class="name"></span><span class="data"></span>`;
      row.children[0].textContent = time(e.t);
      row.children[1].textContent = delta ? `+${delta < 10000 ? delta + "ms" : Math.round(delta / 1000) + "s"}` : "";
      row.children[2].textContent = e.source;
      row.children[3].textContent = e.event + (e.tab ? `  · tab ${e.tab.id}` : "");
      row.children[4].textContent = text(e.data);
      row.title = e.tab?.url || "";
      row.addEventListener("click", () => {
        if (opened.has(key(e))) opened.delete(key(e));
        else opened.add(key(e));
        row.classList.toggle("open");
      });
      return row;
    }),
  );
  if ($("follow").checked && atBottom) box.scrollTop = box.scrollHeight;
}

["search", "errorsOnly"].forEach((id) => $(id).addEventListener("input", render));
$("clearLog").addEventListener("click", () => chrome.storage.session.remove("debugLog"));

// The debugger's own actions go in the log too, so a report shows what was done here.
const note = (event, data) => chrome.runtime.sendMessage({ type: "DEBUG_EVENT", source: "debugger", event, data }).catch(() => {});

// ---------- queue ----------
function showQueue(q) {
  $("queueSummary").textContent = q
    ? `${q.team || "(no team)"} · ${q.players.length} players · #${q.index + 1} ${q.players[q.index]?.name || ""} · ${q.done.length} searched`
    : "empty";
  if (document.activeElement !== $("queue")) $("queue").value = q ? JSON.stringify(q, null, 2) : "";
}

$("saveQueue").addEventListener("click", async () => {
  $("queueError").textContent = "";
  try {
    const q = JSON.parse($("queue").value || "null");
    if (q && (!Array.isArray(q.players) || !Array.isArray(q.done) || typeof q.index !== "number"))
      throw new Error("needs players[], done[] and index");
    await (q ? chrome.storage.local.set({ queue: q }) : chrome.storage.local.remove("queue"));
    note("queue edited by hand");
  } catch (err) {
    $("queueError").textContent = String(err.message || err);
  }
});

$("clearQueue").addEventListener("click", async () => {
  await chrome.storage.local.remove("queue");
  note("queue cleared");
});

$("openCurrent").addEventListener("click", async () => {
  note("open current in Web App");
  const res = await chrome.runtime.sendMessage({ type: "DEBUG_OPEN_CURRENT" }).catch((err) => ({ ok: false, error: String(err) }));
  if (!res?.ok) note("open current failed", res);
});

$("stress").addEventListener("click", async () => {
  const names = ["Ab", "Vinícius José Paixão de Oliveira Júnior", "Đorđe Petrović", "Jean-Philippe Mateta-Kounkoud", "Lee Kang-in", "Ødegaard"];
  const prices = [null, 150, 200, 999, 10_250, 49_999, 999_999, 1_000_000, 14_999_000];
  const players = Array.from({ length: 60 }, (_, i) => ({
    defId: 900000000 + i,
    name: `${names[i % names.length]} ${i + 1}`,
    url: "https://www.fut.gg/players/",
    price: prices[i % prices.length],
  }));
  await chrome.storage.local.set({ queue: { team: "UI stress test with a very long team name", players, index: 0, done: [] } });
  note("loaded UI stress queue", { players: players.length });
});

$("resetStorage").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  await chrome.storage.session.remove("pendingTabId");
  note("storage reset");
});

// ---------- tabs & storage ----------
async function showTabs() {
  const tabs = await chrome.tabs.query({ url: ["https://www.fut.gg/*", "https://www.ea.com/*"] });
  $("tabs").replaceChildren(
    ...(tabs.length
      ? tabs.map((t) => {
          const li = document.createElement("li");
          li.innerHTML = `<button>Go</button><button>Reload</button><span></span>`;
          li.querySelector("span").textContent = `#${t.id} ${t.url}`;
          li.children[0].addEventListener("click", () => chrome.tabs.update(t.id, { active: true }));
          li.children[1].addEventListener("click", () => chrome.tabs.reload(t.id));
          return li;
        })
      : [Object.assign(document.createElement("li"), { textContent: "No fut.gg or Web App tabs open" })]),
  );
}

async function showStorage() {
  const [local, session] = await Promise.all([chrome.storage.local.get(null), chrome.storage.session.get(null)]);
  delete session.debugLog;
  const brief = { ...local };
  if (brief.queue) brief.queue = `{ ${brief.queue.players.length} players, see Queue }`;
  $("storage").textContent = JSON.stringify({ local: brief, session }, null, 2);
}

chrome.tabs.onUpdated.addListener(showTabs);
chrome.tabs.onRemoved.addListener(showTabs);
document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => chrome.tabs.create({ url: b.dataset.open })));

// ---------- bug report ----------
$("report").addEventListener("click", async () => {
  const [{ queue: q }, tabs] = await Promise.all([chrome.storage.local.get("queue"), chrome.tabs.query({ url: ["https://www.fut.gg/*", "https://www.ea.com/*"] })]);
  const report = {
    extension: manifest.version_name || manifest.version,
    browser: navigator.userAgent,
    at: new Date().toISOString(),
    tabs: tabs.map((t) => t.url),
    queue: q || null,
    events: log.slice(-300).map((e) => ({ ...e, t: new Date(e.t).toISOString() })),
  };
  await navigator.clipboard.writeText("```json\n" + JSON.stringify(report, null, 2) + "\n```");
  $("report").textContent = "Copied!";
  setTimeout(() => ($("report").textContent = "Copy bug report"), 1500);
});

// ---------- live updates ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.debugLog) {
    log = changes.debugLog.newValue || [];
    render();
  }
  if (area === "local" && changes.queue) showQueue(changes.queue.newValue);
  showStorage();
});

(async () => {
  const [{ debugLog }, { queue: q }] = await Promise.all([chrome.storage.session.get("debugLog"), chrome.storage.local.get("queue")]);
  log = debugLog || [];
  render();
  showQueue(q);
  showTabs();
  showStorage();
})();
