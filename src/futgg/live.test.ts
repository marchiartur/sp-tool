// @vitest-environment happy-dom
//
// The canary: the real page.ts selectors against the real fut.gg, so a change to the site
// is caught here rather than by someone whose pill stopped appearing.
//
// It reads the snapshots `node scripts/futgg-snapshot.mjs` leaves in ./futgg-snapshots,
// and skips itself when they aren't there, so `pnpm test` stays offline. The scheduled
// workflow (.github/workflows/futgg-canary.yml) renders them first, and attaches them to
// the issue it opens when this file fails — the page as it was, to fix against.
//
//   node scripts/futgg-snapshot.mjs && pnpm test futgg/live
//
// What it does NOT cover: the squad builder, whose pages live behind a per-user UUID that
// nothing public links to. playerFromArt and SEL.squadName are on page.test.ts' fixtures
// alone, so a change there is found the slow way.
import { beforeAll, describe, expect, it } from "vitest"
import type { Player } from "@/panel/types"
import { cards, heroArt, onGallery, onSquad, onTeamPage, playerFromPath, SEL, setCards, teamName } from "./page"

interface Snapshot {
  /** The page it was rendered from, for a failure to name. */
  url: string
  /** Its path, which the URL patterns in page.ts are matched against. */
  path: string
  html: string
}

// vite's glob rather than node:fs, so this test needs no node types in a project whose
// other source is browser-only — and so an absent snapshot is simply an empty record.
const files = import.meta.glob<string>("/futgg-snapshots/*.html", { query: "?raw", import: "default" })
const index = import.meta.glob<{ renderedAt: string; pages: Record<string, { url: string; path: string }> }>(
  "/futgg-snapshots/index.json",
  { import: "default" },
)

const have = Object.keys(index).length > 0
const snapshots: Record<string, Snapshot> = {}

beforeAll(async () => {
  if (!have) return
  const { pages } = await Object.values(index)[0]()
  for (const [name, page] of Object.entries(pages))
    snapshots[name] = { ...page, html: await files[`/futgg-snapshots/${name}.html`]() }
})

/** Puts a snapshot in the document at the path it was rendered from, as the content
 *  script finds it. Only the body: happy-dom would try to fetch the head's scripts. */
function open(name: string) {
  const page = snapshots[name]
  if (!page) throw new Error(`no ${name} snapshot; run node scripts/futgg-snapshot.mjs`)
  history.replaceState(null, "", page.path)
  document.body.innerHTML = page.html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? page.html
  return page
}

const prices = (players: (Player | null)[]) => players.filter((p) => p?.price != null).length

/** How many players the gallery page says its set has, from its "0 / 5 players done". */
const setSize = () => {
  const m = document.body.textContent?.match(/\/\s*(\d+)\s*players done/i)
  return m ? Number(m[1]) : null
}

describe.skipIf(!have)("live fut.gg", () => {
  describe("a FUT Gallery set", () => {
    it("is recognised as a team page", () => {
      const page = open("set")
      expect(onGallery(), `${page.url} no longer matches the gallery URL pattern`).toBe(true)
      expect(onTeamPage()).toBe(true)
      expect(onSquad()).toBe(false)
    })

    it("names the set", () => {
      open("set")
      // The <h1> when it is short enough, else the slug; either way not empty.
      expect(teamName().length).toBeGreaterThan(0)
      expect(teamName().length).toBeLessThanOrEqual(60)
    })

    it("finds the set's players, and leaves the Add players pool out", () => {
      const page = open("set")
      const all = cards()
      const set = setCards()
      expect(set.length, `${page.url}: setCards() found no players`).toBeGreaterThan(0)
      // Sets come in any size (Icons has 5, TOTW 20), so the set is checked against the
      // size fut.gg prints over it, "0 / 5 players done", rather than a fixed number.
      // If that line goes, the check above still stands.
      const size = setSize()
      if (size !== null)
        expect(set.length, `${page.url}: the page says the set has ${size} players`).toBe(size)
      // The pool holds every other eligible player, so the page has more cards than the set.
      expect(set.length, `${page.url}: the "Add players" pool is no longer being excluded`).toBeLessThan(all.length)
    })

    it("reads every player off his card", () => {
      open("set")
      const read = setCards().map((c) => c.read())
      expect(read.filter((p) => p === null), "a card the selectors no longer read").toEqual([])
      for (const p of read) {
        expect(p!.defId).toBeGreaterThan(0)
        expect(p!.name.length).toBeGreaterThan(1)
        expect(p!.url).toContain("/players/")
      }
    })

    it("reads the prices fut.gg prints on the cards", () => {
      const page = open("set")
      const read = setCards().map((c) => c.read())
      // Some cards are genuinely priceless — untradeable, or no listing yet — so this
      // asks only that the coin selector still finds most of them.
      expect(prices(read), `${page.url}: ${prices(read)} of ${read.length} cards gave a price`).toBeGreaterThan(
        read.length / 2,
      )
    })
  })

  describe("a player's own page", () => {
    it("reads him off the URL and his artwork", () => {
      const page = open("player")
      expect(heroArt(), `${page.url}: no unlinked ${SEL.art} to hang the pill on`).not.toBeNull()
      const player = playerFromPath()
      expect(player, `${page.url}: playerFromPath() read nothing`).not.toBeNull()
      expect(page.path).toContain(String(player!.defId))
      expect(player!.name.length).toBeGreaterThan(1)
    })
  })

  describe("a list of players", () => {
    it("finds a card for every player link", () => {
      const page = open("list")
      const found = cards()
      expect(found.length, `${page.url}: found ${found.length} cards`).toBeGreaterThanOrEqual(20)
      expect(
        found.map((c) => c.read()).filter((p) => p === null),
        "a linked card the selectors no longer read",
      ).toEqual([])
    })

    it("is not mistaken for a team page", () => {
      open("list")
      expect(onTeamPage()).toBe(false)
    })
  })
})
