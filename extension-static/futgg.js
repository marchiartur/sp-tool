// fut.gg side: an "Open" pill on every player card and a "Queue team" button on
// gallery pages. Reads only the page you have open; makes no network requests.
(() => {
  const DEV = false; // build-extension.mjs --dev flips this on
  const PLAYER_RE = /\/players\/(\d+)-([a-z0-9-]+)\/(\d{2})-(\d+)/i;
  const PRICE_RE = /^(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*([km])?$/i;
  const GALLERY_RE = /^\/fut-gallery\/[^/]+\/([^/]+)\/?$/;

  // Dev builds: events go to the debug log (debug.html) in the background worker.
  const debug = (event, data) => {
    if (!DEV || !chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ type: "DEBUG_EVENT", source: "fut.gg", event, data }).catch(() => {});
  };
  if (DEV) {
    document.documentElement.dataset.fgxDev = "1"; // futgg.css outlines cards without a price
    addEventListener("error", (e) => String(e.filename).startsWith("chrome-extension:") && debug("error", { message: String(e.message), at: `${e.filename}:${e.lineno}` }));
  }

  const toName = (slug) => slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // ---------- fonts (same as the Web App panel) ----------
  const style = document.createElement("style");
  const font = (family, file, weight) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-display:swap;src:url("${chrome.runtime.getURL(`fonts/${file}`)}") format("woff2")}`;
  style.textContent = [font("Chakra Petch", "chakra-petch-600.woff2", 600), font("Chakra Petch", "chakra-petch-700.woff2", 700)].join("\n");
  document.head.appendChild(style);

  // ---------- price on a card ----------
  function parsePrice(text) {
    const m = text.replace(/\s+/g, " ").trim().match(PRICE_RE);
    if (!m) return null;
    const [, num, suffix] = m;
    const value = suffix
      ? parseFloat(num.replace(",", ".")) * (suffix.toLowerCase() === "k" ? 1e3 : 1e6)
      : parseInt(num.replace(/[.,]/g, ""), 10);
    return Number.isFinite(value) && value >= 150 ? Math.round(value) : null;
  }

  function cardScope(a) {
    let scope = a;
    for (let i = 0; i < 6; i++) {
      const up = scope.parentElement;
      if (!up || up.querySelectorAll('a[href*="/players/"]').length > 1) break;
      scope = up;
    }
    return scope;
  }

  function readPrice(a) {
    const coin = cardScope(a).querySelector('img[src*="coin.webp"], img[alt="Coin" i], img[src*="coin" i]');
    return coin ? parsePrice(coin.parentElement?.textContent || "") : null;
  }

  // Only fut.gg's own player links: never queue a link that points off-site.
  const isPlayerLink = (a) => a.origin === location.origin && PLAYER_RE.test(a.pathname);

  function playerFrom(a) {
    const m = isPlayerLink(a) && a.pathname.match(PLAYER_RE);
    if (!m) return null;
    const [, , slug, , defId] = m;
    return { defId: Number(defId), name: toName(slug), url: a.href, price: readPrice(a) };
  }

  const cards = () => [...document.querySelectorAll("a[data-futgg-ext]")];

  // ---------- team ----------
  function teamName() {
    const slug = location.pathname.match(GALLERY_RE)?.[1];
    if (!slug) return "";
    const h1 = document.querySelector("h1")?.textContent?.trim();
    return h1 && h1.length <= 40 ? h1 : toName(slug);
  }

  // ---------- messaging with friendly errors ----------
  function toast(text) {
    document.querySelector(".fgx-toast")?.remove();
    const t = document.createElement("div");
    t.className = "fgx-toast";
    t.setAttribute("role", "status");
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function send(msg) {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) {
        toast("Extension updated. Refresh this page.");
        return resolve(null);
      }
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            toast(/context invalidated/i.test(err.message) ? "Extension updated. Refresh this page." : "Couldn't reach the extension. Try again.");
            return resolve(null);
          }
          if (!res?.ok) toast("Something went wrong. Try again.");
          resolve(res);
        });
      } catch {
        toast("Extension updated. Refresh this page.");
        resolve(null);
      }
    });
  }

  // ---------- card buttons ----------
  function decorate(a) {
    if (a.dataset.futggExt || !a.querySelector("img") || !isPlayerLink(a)) return;
    a.dataset.futggExt = "1";
    a.classList.add("fgx-host");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fgx-pill fgx-card-btn";
    btn.title = "Open in Web App (Shift+click: add to queue)";
    btn.innerHTML = 'Open <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const player = playerFrom(a);
      debug(e.shiftKey ? "shift+click Open" : "click Open", player || { unreadable: a.href });
      if (!player) return;
      const focus = !e.shiftKey;
      const res = await send({ type: "SEND_PLAYER", player, team: teamName(), focus });
      if (res?.ok && !focus) toast(`${player.name} added to queue`);
    });
    a.appendChild(btn);
  }

  // Dev builds: show what a click would send. Re-checked on every scan because fut.gg
  // fills prices in after the cards render (attribute changes don't re-trigger the observer).
  function markParsed(a) {
    const p = playerFrom(a);
    const btn = a.querySelector(".fgx-card-btn");
    if (btn) btn.title = `Open in Web App (Shift+click: add to queue)
[dev] defId ${p?.defId} · ${p?.name} · price ${p?.price ?? "NOT FOUND"}`;
    if (p?.price == null) a.dataset.fgxNoPrice = "1";
    else delete a.dataset.fgxNoPrice;
  }

  // ---------- "Queue team" button on gallery pages ----------
  let teamBtn = null;
  function ensureTeamButton() {
    const onGallery = GALLERY_RE.test(location.pathname);
    if (!onGallery) {
      teamBtn?.remove();
      teamBtn = null;
      return;
    }
    if (!teamBtn) {
      teamBtn = document.createElement("button");
      teamBtn.type = "button";
      teamBtn.className = "fgx-pill fgx-team-btn";
      teamBtn.addEventListener("click", async () => {
        const seen = new Set();
        const players = cards()
          .map(playerFrom)
          .filter((p) => p && !seen.has(p.defId) && seen.add(p.defId));
        debug("click Queue team", { team: teamName(), players: players.length, withoutPrice: players.filter((p) => p.price == null).map((p) => p.name) });
        if (!players.length) return toast("No players found on this page");
        await send({ type: "QUEUE_TEAM", team: teamName(), players });
      });
      document.body.appendChild(teamBtn);
    }
    // Only touch the DOM when the count changes; rewriting it on every scan
    // would trigger the MutationObserver again and loop on every frame.
    const count = new Set(cards().map((a) => a.getAttribute("href"))).size;
    if (teamBtn.dataset.count === String(count)) return;
    teamBtn.dataset.count = String(count);
    teamBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6"/></svg>Queue team<span class="fgx-count">${count}</span>`;
    teamBtn.disabled = count === 0;
  }

  // ---------- keep up with fut.gg's client-side rendering ----------
  let scheduled = false;
  let lastSummary = "";
  function scan() {
    scheduled = false;
    document.querySelectorAll('a[href*="/players/"]').forEach(decorate);
    ensureTeamButton();
    if (DEV) {
      const all = cards();
      all.forEach(markParsed);
      const summary = { page: location.pathname, cards: all.length, withoutPrice: all.filter((a) => a.dataset.fgxNoPrice).length, gallery: GALLERY_RE.test(location.pathname) };
      const key = JSON.stringify(summary);
      if (key !== lastSummary) {
        lastSummary = key;
        debug("cards scanned", summary);
      }
    }
  }
  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(scan);
    }
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
