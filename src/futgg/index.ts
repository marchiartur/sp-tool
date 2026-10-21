// fut.gg side: an "Open" pill on every player card, and a "Queue team" button on the
// pages that hold a team. Reads only the page you have open; makes no network requests.
// Does nothing at all while the extension is switched off in the toolbar popup.
import { isEnabled, onEnabledChange } from "@/lib/settings"
import { DEV, debug } from "./bridge"
import { cards, onTeamPage } from "./page"
import { addPill, ensureTeamButton, injectFonts, markParsed, teardown } from "./ui"

if (DEV) {
  document.documentElement.dataset.fgxDev = "1" // futgg.css outlines cards without a price
  addEventListener("error", (e) => {
    if (!String(e.filename).startsWith("chrome-extension:")) return
    debug("error", { message: String(e.message), at: `${e.filename}:${e.lineno}` })
  })
}

let running = false // follows the switch in the toolbar popup
let fonts = false
let scheduled = false
let lastSummary = ""

// ---------- keep up with fut.gg's client-side rendering ----------
function scan() {
  scheduled = false
  if (!running) return
  const all = cards()
  all.forEach(addPill)
  ensureTeamButton()
  if (DEV) {
    all.forEach(markParsed)
    const summary = {
      page: location.pathname,
      cards: all.length,
      withoutPrice: document.querySelectorAll("[data-fgx-no-price]").length,
      team: onTeamPage(),
    }
    const key = JSON.stringify(summary)
    if (key !== lastSummary) {
      lastSummary = key
      debug("cards scanned", summary)
    }
  }
}

const observer = new MutationObserver(() => {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(scan)
})

// ---------- the switch in the toolbar popup ----------
function start() {
  if (running) return
  running = true
  if (!fonts) {
    fonts = true // one @font-face block per page, however often the switch is flipped
    injectFonts()
  }
  observer.observe(document.body, { childList: true, subtree: true })
  scan()
}

function stop() {
  if (!running) return
  running = false
  observer.disconnect()
  teardown()
  lastSummary = ""
  debug("switched off", { page: location.pathname })
}

isEnabled().then((on) => on && start())
onEnabledChange((on) => (on ? start() : stop()))
