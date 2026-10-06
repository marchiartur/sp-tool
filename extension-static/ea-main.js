// Runs in the Web App's own JS context (world: MAIN).
// Read-only: opens EA's own Transfer Market results screen and reports the
// Web App's health. No bid, buy or list calls anywhere.
(() => {
  const DEV = false; // build-extension.mjs --dev flips this on
  const FROM_PANEL = "futgg-ext";
  const TO_PANEL = "futgg-ext-main";
  const started = Date.now();
  let health = null;
  let lastScreen = null;
  let searchCount = 0;

  const post = (msg) => window.postMessage({ src: TO_PANEL, ...msg }, location.origin);
  const log = (...a) => console.info("[fut.gg extension]", ...a);
  // Dev builds: the panel forwards these to the debug log (debug.html).
  const debug = (event, data) => DEV && post({ type: "DEBUG", event, data });

  // Same price ladder as src/panel/price.ts (this plain script can't import it): keep them in sync.
  function toValidPrice(price) {
    if (!price) return 0;
    const step = price <= 1000 ? 50 : price <= 10000 ? 100 : price <= 50000 ? 250 : price <= 100000 ? 500 : 1000;
    return Math.max(200, Math.ceil(price / step) * step);
  }

  // ---------- health ----------
  // EA declares these as top-level classes/consts (not on window): check bare names.
  const has = (fn) => {
    try {
      return !!fn();
    } catch {
      return false;
    }
  };

  function checkHealth() {
    const appBooted = has(() => typeof getAppMain === "function");
    const loggedIn = has(() => services.User.getUser());
    const pieces = {
      "search criteria": has(() => typeof UTSearchCriteriaDTO === "function"),
      "search types": has(() => typeof SearchType === "object"),
      "results screen": has(() => typeof UTMarketSearchResultsSplitViewController === "function"),
    };
    const missing = Object.keys(pieces).filter((k) => !pieces[k]);
    const elapsed = Date.now() - started;

    let state;
    if (!appBooted) state = elapsed < 20000 ? "loading" : "loggedOut"; // usually the login screen
    else if (!loggedIn) state = "loggedOut";
    else if (missing.length) state = elapsed < 10000 ? "loading" : "broken";
    else state = "ready";

    if (state !== health) {
      debug("health", { from: health, to: state, appBooted, loggedIn, missing, elapsedMs: elapsed });
      health = state;
      if (state === "broken") log("Web App changed, missing:", missing.join(", "));
      else log("Web App", state);
      post({ type: "HEALTH", state });
    }
  }

  // ---------- open results ----------
  // Every UTSearchCriteriaDTO reachable from the screen (4 levels deep).
  function criteriaInside(root) {
    const found = new Set();
    const seen = new Set();
    const walk = (obj, depth) => {
      if (!obj || typeof obj !== "object" || seen.has(obj) || depth > 4) return;
      seen.add(obj);
      if (obj instanceof UTSearchCriteriaDTO) return void found.add(obj);
      for (const key of Object.keys(obj)) {
        try {
          walk(obj[key], depth + 1);
        } catch {}
      }
    };
    walk(root, 0);
    return [...found];
  }

  function findNav() {
    const current = getAppMain().getRootViewController().getPresentedViewController().getCurrentViewController();
    const tab = current.getCurrentController?.();
    return [tab, tab?.getNavigationController?.(), current.getNavigationController?.(), current].find(
      (x) => typeof x?.pushViewController === "function"
    );
  }

  // Drop EA's cached market searches so a changed Max Buy Now always shows fresh listings.
  let cacheNoteLogged = false;
  function clearMarketCache() {
    const ok = has(() => typeof services.Item.clearTransferMarketCache === "function");
    if (ok) {
      try {
        services.Item.clearTransferMarketCache();
      } catch (err) {
        log("clearing the market cache failed", err);
      }
    }
    if (!cacheNoteLogged) {
      cacheNoteLogged = true;
      if (!ok) log("no market cache method found; relying on the no-op filter");
    }
  }

  function openInMarket(defId, price) {
    clearMarketCache();
    const c = new UTSearchCriteriaDTO();
    c.type = SearchType.PLAYER;
    c.defId = [defId];
    const maxBuy = toValidPrice(price);
    if (maxBuy) c.maxBuy = maxBuy;
    searchCount++;
    const minBuy = searchCount % 2 ? 200 : 0; // no-op filter, only there to avoid EA's cached results
    c.minBuy = minBuy;

    const phone = typeof isPhone === "function" && isPhone();
    const screen = phone ? new UTMarketSearchResultsViewController() : new UTMarketSearchResultsSplitViewController();
    screen.initWithSearchCriteria(c);

    // The screen may copy the criteria instead of keeping ours: find every
    // criteria object it holds and make sure each one carries our filters.
    const copies = criteriaInside(screen);
    copies.forEach((k) => {
      k.type = SearchType.PLAYER;
      k.defId = [defId];
      k.maxBuy = maxBuy || 0;
      k.minBuy = minBuy;
    });

    const nav = findNav();
    debug("search built", {
      defId,
      requestedPrice: price,
      maxBuy,
      minBuy,
      phone,
      criteriaCopies: copies.length,
      nav: nav?.constructor?.name || null,
      firstSearch: !lastScreen,
    });
    if (!nav) throw new Error("navigation not found");

    const push = () => {
      nav.pushViewController(screen);
      lastScreen = screen;
      log("opened", { defId, maxBuy });
      post({ type: "OPENED", defId });
    };

    if (!lastScreen) return push();
    // Later searches start from the same place as the first one.
    if (typeof nav.popToRootViewController === "function") nav.popToRootViewController(false);
    else if (typeof nav.popViewController === "function") nav.popViewController(false);
    setTimeout(() => {
      try {
        push();
      } catch (err) {
        console.error("[fut.gg extension] open failed", err);
        post({ type: "OPEN_FAILED", defId, text: String(err?.message || err) });
      }
    }, 200);
  }

  if (DEV) {
    // Console helpers in the Web App tab (DevTools, top frame): __spDebug.probe(), __spDebug.open(defId, price)
    window.__spDebug = {
      probe: () => ({
        health,
        appBooted: has(() => typeof getAppMain === "function"),
        loggedIn: has(() => services.User.getUser()),
        criteria: has(() => typeof UTSearchCriteriaDTO === "function"),
        searchTypes: has(() => typeof SearchType === "object"),
        resultsScreen: has(() => typeof UTMarketSearchResultsSplitViewController === "function"),
        phone: has(() => isPhone()),
        marketCache: has(() => typeof services.Item.clearTransferMarketCache === "function"),
        nav: has(() => findNav()) ? findNav().constructor.name : null,
        searches: searchCount,
      }),
      open: (defId, price) => openInMarket(Number(defId), price),
      lastScreen: () => lastScreen,
      toValidPrice,
    };
    // Only our own script errors, not the Web App's.
    window.addEventListener("error", (e) => String(e.filename).startsWith("chrome-extension:") && debug("error", { message: String(e.message), at: `${e.filename}:${e.lineno}` }));
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.src !== FROM_PANEL) return;
    const { type, defId, price } = e.data;
    if (type === "PING") return health && post({ type: "HEALTH", state: health });
    if (type !== "OPEN") return;
    debug("OPEN received", { defId, price, health });
    if (health !== "ready") return post({ type: "OPEN_FAILED", defId, text: `Web App is ${health}` });
    try {
      openInMarket(Number(defId), price);
    } catch (err) {
      console.error("[fut.gg extension] open failed", err);
      post({ type: "OPEN_FAILED", defId, text: String(err?.message || err) });
    }
  });

  checkHealth();
  setInterval(checkHealth, 2000); // also catches a session that expires later
})();
