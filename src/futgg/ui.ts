// The extension's own UI on fut.gg: an "Open" pill on each card, a "Queue team" button
// on gallery pages, and the toast they both use to report trouble. Styles: futgg.css.
import { debug, send, type SendProblem } from "./bridge"
import { type Card, onTeamPage, setCards, teamName } from "./page"
import type { Player } from "@/panel/types"

const CARD_BTN = "fgx-card-btn"
const OPEN_TITLE = "Open in Web App (Shift+click: add to queue)"

const TROUBLE: Record<SendProblem, string> = {
  reloaded: "Extension updated. Refresh this page.",
  unreachable: "Couldn't reach the extension. Try again.",
  failed: "Something went wrong. Try again.",
}

/** The same fonts as the Web App panel. */
export function injectFonts(): void {
  const font = (family: string, file: string, weight: number) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-display:swap;src:url("${chrome.runtime.getURL(`fonts/${file}`)}") format("woff2")}`
  const style = document.createElement("style")
  style.textContent = [
    font("Chakra Petch", "chakra-petch-600.woff2", 600),
    font("Chakra Petch", "chakra-petch-700.woff2", 700),
  ].join("\n")
  document.head.appendChild(style)
}

export function toast(text: string): void {
  document.querySelector(".fgx-toast")?.remove()
  const t = document.createElement("div")
  t.className = "fgx-toast"
  t.setAttribute("role", "status")
  t.textContent = text
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}

function pill(className: string): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = `fgx-pill ${className}`
  return btn
}

export function addPill(card: Card): void {
  const { host } = card
  if (host.querySelector(`.${CARD_BTN}`)) return
  host.classList.add("fgx-host")

  const btn = pill(CARD_BTN)
  btn.title = OPEN_TITLE
  btn.innerHTML = 'Open <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'

  btn.addEventListener("click", async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const player = card.read()
    debug(e.shiftKey ? "shift+click Open" : "click Open", player ?? { unreadable: card.id })
    if (!player) return
    const focus = !e.shiftKey
    const res = await send({ type: "SEND_PLAYER", player, team: teamName(), focus })
    if (!res.ok) toast(TROUBLE[res.problem])
    else if (!focus) toast(`${player.name} added to queue`)
  })
  host.appendChild(btn)
}

/** Dev builds: show what a click would send. Re-checked on every scan because fut.gg
 *  fills prices in after the cards render (attribute changes don't re-trigger the observer). */
export function markParsed({ host, read }: Card): void {
  const p = read()
  const btn = host.querySelector<HTMLElement>(`.${CARD_BTN}`)
  if (btn) btn.title = `${OPEN_TITLE}\n[dev] defId ${p?.defId} · ${p?.name} · price ${p?.price ?? "NOT FOUND"}`
  if (p?.price == null) host.dataset.fgxNoPrice = "1"
  else delete host.dataset.fgxNoPrice
}

/** The players a "Queue team" click would send: the set's own, each one once. */
function queue(): Player[] {
  const seen = new Set<number>()
  const players: Player[] = []
  for (const card of setCards()) {
    const p = card.read()
    if (!p || seen.has(p.defId)) continue
    seen.add(p.defId)
    players.push(p)
  }
  return players
}

let teamBtn: HTMLButtonElement | null = null

export function ensureTeamButton(): void {
  if (!onTeamPage()) {
    teamBtn?.remove()
    teamBtn = null
    return
  }
  // isConnected, not just non-null: if fut.gg ever replaces the body the button goes
  // with it, and a stale reference would leave the page without one for good.
  if (!teamBtn?.isConnected) {
    teamBtn = pill("fgx-team-btn")
    teamBtn.addEventListener("click", async () => {
      const players = queue()
      debug("click Queue team", {
        team: teamName(),
        players: players.length,
        withoutPrice: players.filter((p) => p.price == null).map((p) => p.name),
      })
      if (!players.length) return toast("No players found on this page")
      const res = await send({ type: "QUEUE_TEAM", team: teamName(), players })
      if (!res.ok) toast(TROUBLE[res.problem])
    })
    document.body.appendChild(teamBtn)
  }
  // Only touch the DOM when the count changes; rewriting it on every scan
  // would trigger the MutationObserver again and loop on every frame.
  const count = new Set(setCards().map((c) => c.id)).size
  if (teamBtn.dataset.count === String(count)) return
  teamBtn.dataset.count = String(count)
  teamBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6"/></svg>Queue team<span class="fgx-count">${count}</span>`
  teamBtn.disabled = count === 0
}

/** Takes every trace of the extension off the page: the switch has been turned off. */
export function teardown(): void {
  for (const el of document.querySelectorAll(".fgx-pill, .fgx-toast")) el.remove()
  for (const host of document.querySelectorAll<HTMLElement>(".fgx-host")) {
    host.classList.remove("fgx-host")
    delete host.dataset.fgxNoPrice
  }
  teamBtn = null
}
