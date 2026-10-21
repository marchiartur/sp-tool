// Reading fut.gg.
//
// The only module that knows how fut.gg builds a page, so a change to the site is a
// change to one file. What it hands the rest of the content script is a Card: the
// artwork to pin the "Open" pill on, and how to read that player off the page.
import { parseAmount } from "@/lib/price"
import type { Player } from "@/panel/types"

export interface Card {
  /** The card artwork, and so where the pill goes. */
  host: HTMLElement
  /** Reads the player as the page currently shows him, or null if he can't be read. */
  read: () => Player | null
  /** Tells one card on a page from another: its link, or his portrait where a card has
   *  no link. Live, because fut.gg rewrites links in place. */
  readonly id: string
}

export const SEL = {
  link: 'a[href*="/players/"]', // any link into a player's page
  art: ".fc-card", // the card artwork, and so the pill's home
  coin: 'img[src*="coin.webp"], img[alt="Coin" i], img[src*="coin" i]',
  heading: "h1, h2, h3, h4",
  // The squad builder names the squad in the one heading it gives a title attribute to
  // (fut.gg sets one wherever it truncates text).
  squadName: "h2[title]",
}

const PLAYER_RE = /\/players\/(\d+)-([a-z0-9-]+)\/(\d{2})-(\d+)/i // /players/<id>-<slug>/<game>-<defId>
const GALLERY_RE = /^\/fut-gallery\/[^/]+\/([^/]+)\/?$/
const SQUAD_RE = /^\/\d{2}\/squad-builder\// // /27/squad-builder/<uuid>/
const POOL_RE = /^add players/i
const PORTRAIT_RE = /\/player-item\/\d{2}-(\d+)\./ // the cut-out on a squad builder card

/** EA's cheapest listing is 200 coins, so a smaller number on a card is noise — a
 *  rating, a count — rather than a price. The margin below it leaves fut.gg room to
 *  print a real price rounded down. */
const MIN_CARD_PRICE = 150

const toName = (slug: string) =>
  slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

/** A price as fut.gg prints it on a card: "650", "44K", "1.2m". */
export function parseCardPrice(text: string): number | null {
  const n = parseAmount(text)
  return n !== null && n >= MIN_CARD_PRICE ? Math.round(n) : null
}

/** The chunk of page one card occupies: walk up from the link until a parent covers
 *  more than one player, and everything inside belongs to this player alone. */
export function cardScope(a: Element): Element {
  let scope = a
  for (let i = 0; i < 6; i++) {
    const up = scope.parentElement
    if (!up || up.querySelectorAll(SEL.link).length > 1) break
    scope = up
  }
  return scope
}

export function readPrice(scope: Element): number | null {
  const coin = scope.querySelector(SEL.coin)
  return coin ? parseCardPrice(coin.parentElement?.textContent || "") : null
}

/** Only fut.gg's own player links: never queue a link that points off-site. */
export const isPlayerLink = (a: HTMLAnchorElement) =>
  a.origin === location.origin && PLAYER_RE.test(a.pathname)

/** Where a card's pill goes. fut.gg draws the artwork in .fc-card: on player lists the
 *  link wraps that artwork, but on gallery pages the link is only a small icon button in
 *  the card's footer, so the pill hangs off the artwork rather than off the link. */
export const pillHost = (a: HTMLAnchorElement): HTMLElement | null =>
  cardScope(a).querySelector<HTMLElement>(SEL.art) ?? (a.querySelector("img") ? a : null)

export function playerFromLink(a: HTMLAnchorElement): Player | null {
  const m = isPlayerLink(a) ? a.pathname.match(PLAYER_RE) : null
  if (!m) return null
  const [, , slug, , defId] = m
  return { defId: Number(defId), name: toName(slug), url: a.href, price: readPrice(cardScope(a)) }
}

/** A player's own page draws that player's card with no link around it, so there is no
 *  link to read him off. Of the cards on such a page — the others belong to its lists —
 *  his own is the biggest one that sits outside a link. */
export function heroArt(): HTMLElement | null {
  if (!PLAYER_RE.test(location.pathname)) return null
  return [...document.querySelectorAll<HTMLElement>(SEL.art)]
    .filter((art) => !art.closest(SEL.link))
    .reduce<HTMLElement | null>((best, art) => (!best || art.offsetWidth > best.offsetWidth ? art : best), null)
}

/** ...so the URL names him instead. */
export function playerFromPath(): Player | null {
  const m = location.pathname.match(PLAYER_RE)
  const art = m ? heroArt() : null
  if (!m || !art) return null
  const [, , slug, , defId] = m
  return { defId: Number(defId), name: toName(slug), url: location.href, price: readPrice(art) }
}

/** The player cut-out on a card, whose URL carries his id. */
const portraitOf = (art: Element) =>
  [...art.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "").find((src) => PORTRAIT_RE.test(src)) ?? null

/** The squad builder puts no link on its cards and no slug in its URL, so a player is
 *  read off the card itself: his id from his portrait, his name from the first line the
 *  card prints. */
function playerFromArt(art: HTMLElement): Player | null {
  const defId = portraitOf(art)?.match(PORTRAIT_RE)?.[1]
  const name = [...art.querySelectorAll("*")].find((e) => !e.children.length && e.textContent?.trim())?.textContent?.trim()
  if (!defId || !name) return null
  // No player page to point at, so his name in the panel links back to the squad.
  return { defId: Number(defId), name, url: location.href, price: readPrice(art) }
}

// Every card is rebuilt from the DOM on each call, so cards fut.gg has since dropped go
// with it. Each link's card is remembered because scans are frequent — fut.gg rewrites
// the DOM constantly — and finding the artwork is the slow part.
const cardOf = new WeakMap<HTMLAnchorElement, Card>()

export function cards(): Card[] {
  const found: Card[] = []
  const taken = new Set<HTMLElement>()
  for (const a of document.querySelectorAll<HTMLAnchorElement>(SEL.link)) {
    if (!isPlayerLink(a)) continue
    let card = cardOf.get(a)
    if (!card) {
      const host = pillHost(a)
      if (!host) continue // a link in prose, not a card
      card = { host, read: () => playerFromLink(a), get id() { return a.href } }
      cardOf.set(a, card)
    }
    taken.add(card.host)
    found.push(card)
  }
  const hero = heroArt()
  if (hero) {
    taken.add(hero)
    found.push({ host: hero, read: playerFromPath, get id() { return location.href } })
  }
  if (onSquad())
    for (const art of document.querySelectorAll<HTMLElement>(SEL.art)) {
      const portrait = taken.has(art) ? null : portraitOf(art)
      if (portrait) found.push({ host: art, read: () => playerFromArt(art), id: portrait })
    }
  return found
}

/** A gallery page lists the set's lineup, then every other player eligible for it under
 *  an "Add players" heading. */
function poolList(): Element | null {
  let node: Element | null =
    [...document.querySelectorAll(SEL.heading)].find((h) => POOL_RE.test(h.textContent?.trim() ?? "")) ?? null
  for (let i = 0; node && i < 6; i++, node = node.parentElement) {
    const list = node.querySelector("ul")
    if (list?.querySelector(SEL.link)) return list
  }
  return null
}

/** The set's own players. The "Add players" pool is alternatives to pick from rather
 *  than part of the set, so it is left out — and if that heading ever goes, every card
 *  counts again rather than none. */
export function setCards(): Card[] {
  const pool = poolList()
  return pool ? cards().filter((c) => !pool.contains(c.host)) : cards()
}

export const onGallery = () => GALLERY_RE.test(location.pathname)
export const onSquad = () => SQUAD_RE.test(location.pathname)

/** A page whose cards make up one team, worth queueing in a single click. */
export const onTeamPage = () => onGallery() || onSquad()

export function teamName(): string {
  const slug = location.pathname.match(GALLERY_RE)?.[1]
  if (slug) {
    const h1 = document.querySelector("h1")?.textContent?.trim()
    return h1 && h1.length <= 40 ? h1 : toName(slug)
  }
  if (!onSquad()) return ""
  // A squad can go unnamed, and the worker clamps whatever this is to 60 characters.
  return document.querySelector(SEL.squadName)?.textContent?.trim() || "Squad"
}
