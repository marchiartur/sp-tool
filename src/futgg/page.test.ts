// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { cards, heroArt, onGallery, onSquad, onTeamPage, parseCardPrice, pillHost, playerFromPath, setCards, teamName } from "./page"

/** The card artwork, with fut.gg's coin price inside it. */
const art = (name: string, price: string) => `
  <div class="fc-card">
    <img src="https://game-assets.fut.gg/27-1.webp" alt="${name}" />
    <span><img src="/public-assets/coin.webp" alt="FC Coin" />${price}</span>
  </div>`

/** Gallery pages: the link is a small icon button in the card's footer, beside the art. */
const galleryCard = (href: string, name: string, price: string) => `
  <li class="min-w-0">
    <div>${art(name, price)}</div>
    <div class="footer">
      <button aria-label="Mark ${name} as done"></button>
      <a href="${href}" aria-label="Open player page"><svg></svg></a>
    </div>
  </li>`

/** Player lists: the link wraps the art. */
const listCard = (href: string, name: string, price: string) => `<li><a href="${href}">${art(name, price)}</a></li>`

const at = (path: string) => history.replaceState(null, "", path)

beforeEach(() => {
  document.body.innerHTML = ""
  at("/")
})

describe("parseCardPrice", () => {
  it.each([
    ["650", 650],
    ["44K", 44_000],
    ["1.2m", 1_200_000],
    ["43.8k", 43_800],
    ["1,500,000", 1_500_000],
  ])("reads %s as %d", (text, value) => expect(parseCardPrice(text)).toBe(value))

  it.each(["", "EXTINCT", "100", "abc", "15 / 15 picked", "5.2K5,200"])("rejects %j", (text) =>
    expect(parseCardPrice(text)).toBeNull(),
  )
})

describe("cards on a gallery page", () => {
  beforeEach(() => {
    at("/fut-gallery/premier-league/fulham/")
    document.body.innerHTML = `
      <h2>Cheapest grade S lineup</h2>
      <ul>
        ${galleryCard("/players/192563-bernd-leno/27-192563/", "Leno", "900")}
        ${galleryCard("/players/213655-alex-iwobi/27-213655/", "Iwobi", "650")}
      </ul>`
  })

  it("finds one card per player", () => {
    expect(cards()).toHaveLength(2)
  })

  it("pins the pill to the artwork, not to the footer link", () => {
    const [card] = cards()
    expect(card.host.className).toContain("fc-card")
    expect(card.host.tagName).toBe("DIV")
  })

  it("reads the player off the card", () => {
    expect(cards()[0].read()).toEqual({
      defId: 192563,
      name: "Bernd Leno",
      url: `${location.origin}/players/192563-bernd-leno/27-192563/`,
      price: 900,
    })
  })

  it("returns the same card object across scans, so pills aren't added twice", () => {
    expect(cards()[0]).toBe(cards()[0])
    expect(cards()).toHaveLength(2)
  })
})

describe("cards on a player list", () => {
  beforeEach(() => {
    at("/players/")
    document.body.innerHTML = `<ul>${listCard("/players/231747-kylian-mbappe/27-231747/", "Mbappé", "3.2M")}</ul>`
  })

  it("still pins the pill to the artwork inside the link", () => {
    const [card] = cards()
    expect(card.host.className).toContain("fc-card")
    expect(card.host.closest("a")).not.toBeNull()
  })

  it("reads the price", () => {
    expect(cards()[0].read()?.price).toBe(3_200_000)
  })

  it("has no price when fut.gg shows none", () => {
    document.querySelector("span")!.remove()
    expect(cards()[0].read()?.price).toBeNull()
  })
})

describe("links that aren't cards", () => {
  it("ignores a player link in prose", () => {
    document.body.innerHTML = `<p>See <a href="/players/192563-bernd-leno/27-192563/">Leno</a>.</p>`
    expect(cards()).toHaveLength(0)
  })

  it("ignores a link that points off-site", () => {
    document.body.innerHTML = `<ul>${listCard("https://example.com/players/1-x/27-1/", "X", "900")}</ul>`
    expect(cards()).toHaveLength(0)
  })

  it("ignores a fut.gg link that names no player", () => {
    document.body.innerHTML = `<ul>${listCard("/players/trending/", "Trending", "900")}</ul>`
    expect(cards()).toHaveLength(0)
  })

  it("has no pill host for a bare text link", () => {
    document.body.innerHTML = `<a id="a" href="/players/192563-bernd-leno/27-192563/">Leno</a>`
    expect(pillHost(document.querySelector("a")!)).toBeNull()
  })
})

describe("the set on a gallery page", () => {
  const withPool = `
    <h2>Cheapest grade S lineup</h2>
    <ul>${galleryCard("/players/192563-bernd-leno/27-192563/", "Leno", "900")}</ul>
    <div>
      <h2>Add players30</h2>
      <ul>
        ${galleryCard("/players/213655-alex-iwobi/27-213655/", "Iwobi", "650")}
        ${galleryCard("/players/70786-josh-king/27-50402434/", "King", "44K")}
      </ul>
    </div>`

  beforeEach(() => at("/fut-gallery/premier-league/fulham/"))

  it("leaves the \"Add players\" pool out of the set", () => {
    document.body.innerHTML = withPool
    expect(cards()).toHaveLength(3)
    expect(setCards().map((c) => c.read()?.name)).toEqual(["Bernd Leno"])
  })

  it("counts every card when there is no pool", () => {
    document.body.innerHTML = withPool.replace("Add players30", "More Fulham players")
    expect(setCards()).toHaveLength(3)
  })
})

describe("a squad builder", () => {
  // Its cards carry no link: the player's id is in his portrait's URL and his name is
  // the first line the card prints.
  const squadCard = (defId: number, name: string, rating: number, price: string) => `
    <div class="fc-card">
      <img src="https://game-assets.fut.gg/2027/rarities-level-3-large/0.abc.png" alt="" />
      <img src="https://game-assets.fut.gg/cdn-cgi/image/width=300/2027/player-item/27-${defId}.deadbeef.webp" alt="" />
      <div><div>${name}</div><div>${rating}</div><div>CM</div></div>
      <span><img src="/public-assets/coin.webp" alt="FC Coin" />${price}</span>
    </div>`

  const SQUAD = "/27/squad-builder/d483e78c-c06a-4d6f-ada9-88f136312046/"

  beforeEach(() => {
    at(SQUAD)
    document.body.innerHTML = `
      <div class="pitch">
        ${squadCard(263887, "Urbig", 79, "850")}
        ${squadCard(76299, "Trummer", 66, "500")}
        ${squadCard(277270, "Zé", 59, "200")}
      </div>`
  })

  it("counts as a team page, so the Queue team button shows", () => {
    expect(onSquad()).toBe(true)
    expect(onTeamPage()).toBe(true)
    expect(onGallery()).toBe(false)
  })

  it("finds every player on the pitch", () => {
    expect(cards()).toHaveLength(3)
  })

  it("reads a player off the card itself", () => {
    expect(cards()[0].read()).toEqual({
      defId: 263887,
      name: "Urbig",
      url: location.href,
      price: 850,
    })
  })

  it("keeps names with accents intact", () => {
    expect(cards().map((c) => c.read()?.name)).toEqual(["Urbig", "Trummer", "Zé"])
  })

  it("pins the pill to the card and tells the cards apart", () => {
    const all = cards()
    expect(all.every((c) => c.host.classList.contains("fc-card"))).toBe(true)
    expect(new Set(all.map((c) => c.id)).size).toBe(3)
  })

  it("skips an empty slot in the formation", () => {
    document.querySelector(".pitch")!.insertAdjacentHTML("beforeend", `<div class="fc-card"><span>+</span></div>`)
    expect(document.querySelectorAll(".fc-card")).toHaveLength(4)
    expect(cards()).toHaveLength(3)
  })

  it("labels the queue with the squad's name", () => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<h2 title="Marquee Matchups - FC Bayern München v RB Leipzig">Marquee Matchups - FC Bayern München v RB Leipzig</h2>`,
    )
    expect(teamName()).toBe("Marquee Matchups - FC Bayern München v RB Leipzig")
  })

  it("falls back to a plain label for an unnamed squad", () => {
    expect(teamName()).toBe("Squad")
  })

  it("ignores the site's own headings, which carry no title", () => {
    document.body.insertAdjacentHTML("afterbegin", `<h2>Latest Squads</h2><h2>Players</h2>`)
    expect(teamName()).toBe("Squad")
  })

  it("queues every player once", () => {
    expect(setCards()).toHaveLength(3)
  })

  it("leaves a player with no price readable", () => {
    document.querySelector("span")!.remove()
    expect(cards()[0].read()).toMatchObject({ defId: 263887, price: null })
  })

  it("reads nothing from a squad card away from a squad page", () => {
    at("/players/")
    expect(cards()).toHaveLength(0)
  })
})

describe("teamName", () => {
  it("prefers the page's heading", () => {
    at("/fut-gallery/premier-league/fulham/")
    document.body.innerHTML = `<h1>Fulham FUT Gallery Set</h1>`
    expect(teamName()).toBe("Fulham FUT Gallery Set")
  })

  it("falls back to the slug when the heading is too long", () => {
    at("/fut-gallery/premier-league/fulham/")
    document.body.innerHTML = `<h1>${"x".repeat(41)}</h1>`
    expect(teamName()).toBe("Fulham")
  })

  it("is empty away from a gallery page", () => {
    at("/players/")
    expect(teamName()).toBe("")
  })
})

describe("a player's own page", () => {
  const wide = (el: HTMLElement, width: number) => Object.defineProperty(el, "offsetWidth", { value: width })

  beforeEach(() => {
    at("/players/192563-bernd-leno/27-192563/")
    document.body.innerHTML = `
      <div id="hero">${art("Leno", "900")}</div>
      <h2>Other players</h2>
      <ul>${listCard("/players/213655-alex-iwobi/27-213655/", "Iwobi", "650")}</ul>`
  })

  it("takes the card that isn't inside a link as the player's own", () => {
    expect(heroArt()).toBe(document.querySelector("#hero .fc-card"))
  })

  it("reads the player from the URL, since no link names him", () => {
    expect(playerFromPath()).toEqual({
      defId: 192563,
      name: "Bernd Leno",
      url: location.href,
      price: 900,
    })
  })

  it("adds his card to the page's cards", () => {
    expect(cards()).toHaveLength(2) // his own, plus the one in the list below
    expect(cards().at(-1)?.read()?.name).toBe("Bernd Leno")
  })

  it("prefers the biggest card when several sit outside a link", () => {
    document.body.insertAdjacentHTML("afterbegin", `<div id="thumb">${art("Leno", "900")}</div>`)
    const thumb = document.querySelector<HTMLElement>("#thumb .fc-card")!
    const hero = document.querySelector<HTMLElement>("#hero .fc-card")!
    wide(thumb, 40)
    wide(hero, 220)
    expect(heroArt()).toBe(hero)
  })

  it("has no hero card away from a player page", () => {
    at("/fut-gallery/premier-league/fulham/")
    expect(heroArt()).toBeNull()
    expect(playerFromPath()).toBeNull()
  })
})
