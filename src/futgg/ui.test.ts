// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cards } from "./page"
import { addPill, ensureTeamButton, injectFonts, markParsed, teardown, toast } from "./ui"
import { send } from "./bridge"

// The pill and the team button are wired to the worker; the transport itself is
// bridge.test.ts's job, so here it only has to answer.
vi.mock("./bridge", () => ({ DEV: false, debug: vi.fn(), send: vi.fn() }))
const sent = vi.mocked(send)

const art = (name: string, price: string) => `
  <div class="fc-card">
    <img src="https://game-assets.fut.gg/27-1.webp" alt="${name}" />
    <span><img src="/public-assets/coin.webp" alt="FC Coin" />${price}</span>
  </div>`

const galleryCard = (href: string, name: string, price: string) => `
  <li>
    <div>${art(name, price)}</div>
    <div><a href="${href}" aria-label="Open player page"><svg></svg></a></div>
  </li>`

const at = (path: string) => history.replaceState(null, "", path)
const pills = () => [...document.querySelectorAll<HTMLButtonElement>(".fgx-card-btn")]
const teamButton = () => document.querySelector<HTMLButtonElement>(".fgx-team-btn")
const click = (el: Element, init: MouseEventInit = {}) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }))
const settle = () => new Promise((r) => setTimeout(r, 0))

const LENO = "/players/192563-bernd-leno/27-192563/"
const IWOBI = "/players/213655-alex-iwobi/27-213655/"

beforeEach(() => {
  vi.clearAllMocks()
  sent.mockResolvedValue({ ok: true })
  document.body.innerHTML = ""
  document.head.innerHTML = ""
  at("/fut-gallery/premier-league/fulham/")
})

describe("injectFonts", () => {
  it("adds both weights, served from the extension", () => {
    vi.stubGlobal("chrome", { runtime: { getURL: (p: string) => `chrome-extension://abc/${p}` } })
    injectFonts()
    const css = document.head.querySelector("style")?.textContent ?? ""
    expect(css).toContain(`src:url("chrome-extension://abc/fonts/chakra-petch-600.woff2")`)
    expect(css).toContain(`src:url("chrome-extension://abc/fonts/chakra-petch-700.woff2")`)
    vi.unstubAllGlobals()
  })
})

describe("the Open pill", () => {
  beforeEach(() => {
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}</ul>`
    cards().forEach(addPill)
  })

  it("hangs one pill off the artwork", () => {
    expect(pills()).toHaveLength(1)
    expect(pills()[0].parentElement?.className).toContain("fc-card")
    expect(pills()[0].parentElement?.classList.contains("fgx-host")).toBe(true)
  })

  it("is not added twice when the page is scanned again", () => {
    cards().forEach(addPill)
    cards().forEach(addPill)
    expect(pills()).toHaveLength(1)
  })

  it("opens the player in the Web App on a plain click", async () => {
    click(pills()[0])
    await settle()
    expect(sent).toHaveBeenCalledWith({
      type: "SEND_PLAYER",
      player: { defId: 192563, name: "Bernd Leno", url: `${location.origin}${LENO}`, price: 900 },
      team: "Fulham",
      focus: true,
    })
    expect(document.querySelector(".fgx-toast")).toBeNull()
  })

  it("queues the player on a shift+click, and says so", async () => {
    click(pills()[0], { shiftKey: true })
    await settle()
    expect(sent.mock.calls[0][0]).toMatchObject({ focus: false })
    expect(document.querySelector(".fgx-toast")?.textContent).toBe("Bernd Leno added to queue")
  })

  it.each([
    ["reloaded", "Extension updated. Refresh this page."],
    ["unreachable", "Couldn't reach the extension. Try again."],
    ["failed", "Something went wrong. Try again."],
  ] as const)("reports a %s worker", async (problem, message) => {
    sent.mockResolvedValue({ ok: false, problem })
    click(pills()[0])
    await settle()
    expect(document.querySelector(".fgx-toast")?.textContent).toBe(message)
  })

  it("stops the link from following the click", () => {
    const e = new MouseEvent("click", { bubbles: true, cancelable: true })
    pills()[0].dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it("sends nothing when the player can't be read", async () => {
    document.body.innerHTML = `<div class="fc-card" id="orphan"></div>`
    const host = document.querySelector<HTMLElement>("#orphan")!
    addPill({ host, read: () => null, id: "/nowhere" })
    click(host.querySelector(".fgx-card-btn")!)
    await settle()
    expect(sent).not.toHaveBeenCalled()
  })
})

describe("the Queue team button", () => {
  beforeEach(() => {
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}${galleryCard(IWOBI, "Iwobi", "650")}</ul>`
  })

  it("appears on a gallery page, counting the set", () => {
    ensureTeamButton()
    expect(teamButton()?.textContent).toContain("Queue team")
    expect(teamButton()?.querySelector(".fgx-count")?.textContent).toBe("2")
    expect(teamButton()?.disabled).toBe(false)
  })

  it("goes away off a gallery page", () => {
    ensureTeamButton()
    at("/players/")
    ensureTeamButton()
    expect(teamButton()).toBeNull()
  })

  it("is disabled when the page holds no players", () => {
    document.body.innerHTML = ""
    ensureTeamButton()
    expect(teamButton()?.disabled).toBe(true)
    expect(teamButton()?.querySelector(".fgx-count")?.textContent).toBe("0")
  })

  it("comes back if the page is replaced under it", () => {
    ensureTeamButton()
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}</ul>` // takes the button with it
    expect(teamButton()).toBeNull()
    ensureTeamButton()
    expect(teamButton()).not.toBeNull()
  })

  it("queues the set, each player once", async () => {
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}${galleryCard(LENO, "Leno", "900")}${galleryCard(IWOBI, "Iwobi", "650")}</ul>`
    ensureTeamButton()
    expect(teamButton()?.querySelector(".fgx-count")?.textContent).toBe("2") // two distinct links
    click(teamButton()!)
    await settle()
    const msg = sent.mock.calls[0][0] as { type: string; team: string; players: { name: string }[] }
    expect(msg.type).toBe("QUEUE_TEAM")
    expect(msg.team).toBe("Fulham")
    expect(msg.players.map((p) => p.name)).toEqual(["Bernd Leno", "Alex Iwobi"])
  })

  it("can't be clicked at all while it counts nothing", async () => {
    document.body.innerHTML = ""
    ensureTeamButton()
    click(teamButton()!)
    await settle()
    expect(sent).not.toHaveBeenCalled()
  })

  it("says so rather than sending an empty queue when the cards go first", async () => {
    ensureTeamButton() // enabled, with two cards counted
    document.querySelector("ul")!.remove() // fut.gg re-renders them away before the click
    click(teamButton()!)
    await settle()
    expect(sent).not.toHaveBeenCalled()
    expect(document.querySelector(".fgx-toast")?.textContent).toBe("No players found on this page")
  })

  it("reports a worker that won't take the queue", async () => {
    sent.mockResolvedValue({ ok: false, problem: "unreachable" })
    ensureTeamButton()
    click(teamButton()!)
    await settle()
    expect(document.querySelector(".fgx-toast")?.textContent).toBe("Couldn't reach the extension. Try again.")
  })
})

describe("toast", () => {
  it("replaces the previous one rather than stacking", () => {
    toast("first")
    toast("second")
    expect(document.querySelectorAll(".fgx-toast")).toHaveLength(1)
    expect(document.querySelector(".fgx-toast")?.textContent).toBe("second")
  })

  it("is announced to screen readers", () => {
    toast("hello")
    expect(document.querySelector(".fgx-toast")?.getAttribute("role")).toBe("status")
  })
})

describe("markParsed (dev builds)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}</ul>`
    cards().forEach(addPill)
  })

  it("shows what a click would send", () => {
    cards().forEach(markParsed)
    expect(pills()[0].title).toContain("[dev] defId 192563 · Bernd Leno · price 900")
  })

  it("flags a card whose price couldn't be read, and unflags it once it can", () => {
    const price = document.querySelector("span")!
    price.remove()
    cards().forEach(markParsed)
    const host = pills()[0].parentElement!
    expect(host.dataset.fgxNoPrice).toBe("1")
    expect(pills()[0].title).toContain("price NOT FOUND")

    document.querySelector(".fc-card")!.append(price)
    cards().forEach(markParsed)
    expect(host.dataset.fgxNoPrice).toBeUndefined()
  })
})

describe("teardown", () => {
  it("leaves the page as fut.gg drew it", () => {
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}${galleryCard(IWOBI, "Iwobi", "1.2K")}</ul>`
    const before = document.body.innerHTML
    cards().forEach(addPill)
    cards().forEach(markParsed)
    ensureTeamButton()
    toast("something went wrong")

    teardown()

    expect(document.body.innerHTML).toBe(before)
    expect(document.querySelector(".fgx-toast")).toBeNull()
  })

  it("lets the buttons come back when the switch goes on again", () => {
    document.body.innerHTML = `<ul>${galleryCard(LENO, "Leno", "900")}</ul>`
    cards().forEach(addPill)
    ensureTeamButton()
    teardown()

    cards().forEach(addPill)
    ensureTeamButton()
    expect(pills()).toHaveLength(1)
    expect(teamButton()).not.toBeNull()
  })
})
