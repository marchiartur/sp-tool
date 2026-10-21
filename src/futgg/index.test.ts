// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Card } from "./page"

// index.ts is the wiring: what it has to get right is scanning once up front, coalescing
// fut.gg's stream of mutations into one scan per frame, and following the on/off switch.
const card = (id: string): Card => ({ host: document.createElement("div"), read: () => null, id })

const cards = vi.fn<() => Card[]>(() => [])
const addPill = vi.fn()
const ensureTeamButton = vi.fn()
const injectFonts = vi.fn()
const markParsed = vi.fn()
const teardown = vi.fn()

let enabled = true
/** The callback index.ts gives onEnabledChange: the switch, as the popup flips it. */
let flip: (on: boolean) => void = () => {}

vi.mock("./page", () => ({ cards: () => cards(), onTeamPage: () => false }))
vi.mock("./ui", () => ({
  addPill: (c: Card) => addPill(c),
  ensureTeamButton: () => ensureTeamButton(),
  injectFonts: () => injectFonts(),
  markParsed: (c: Card) => markParsed(c),
  teardown: () => teardown(),
}))
vi.mock("./bridge", () => ({ DEV: false, debug: vi.fn() }))
vi.mock("@/lib/settings", () => ({
  isEnabled: async () => enabled,
  onEnabledChange: (fn: (on: boolean) => void) => {
    flip = fn
    return () => {}
  },
}))

/** requestAnimationFrame, under the test's control. */
let frame: FrameRequestCallback[] = []
const nextFrame = async () => {
  const due = frame
  frame = []
  due.forEach((cb) => cb(0))
  await new Promise((r) => setTimeout(r, 0))
}

/** Lets the MutationObserver deliver — it batches into a microtask. */
const observed = () => new Promise((r) => setTimeout(r, 0))

const start = async () => {
  vi.resetModules()
  await import("./index")
  await observed() // the first scan waits on the switch, which is read from storage
}

beforeEach(() => {
  vi.clearAllMocks()
  frame = []
  enabled = true
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frame.push(cb))
  // Each start() leaves a module instance observing the body it was given. Hand every
  // test a fresh one, so only its own instance sees the mutations it makes.
  document.documentElement.replaceChild(document.createElement("body"), document.body)
  cards.mockReturnValue([])
})

describe("starting up", () => {
  it("loads the fonts and scans the page once", async () => {
    cards.mockReturnValue([card("a"), card("b")])
    await start()
    expect(injectFonts).toHaveBeenCalledOnce()
    expect(addPill).toHaveBeenCalledTimes(2)
    expect(ensureTeamButton).toHaveBeenCalledOnce()
  })

  it("leaves the dev-only work out of a release build", async () => {
    cards.mockReturnValue([card("a")])
    await start()
    expect(markParsed).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.fgxDev).toBeUndefined()
  })
})

describe("keeping up with fut.gg", () => {
  it("rescans after the page changes", async () => {
    await start()
    ensureTeamButton.mockClear()

    document.body.append(document.createElement("div"))
    await observed()
    await nextFrame()

    expect(ensureTeamButton).toHaveBeenCalledOnce()
  })

  it("coalesces a burst of changes into one scan", async () => {
    await start()
    ensureTeamButton.mockClear()

    for (let i = 0; i < 5; i++) document.body.append(document.createElement("div"))
    await observed()
    expect(frame).toHaveLength(1) // one frame asked for, not five
    await nextFrame()

    expect(ensureTeamButton).toHaveBeenCalledOnce()
  })

  it("asks for a new frame once the last scan has run", async () => {
    await start()
    document.body.append(document.createElement("div"))
    await observed()
    await nextFrame()
    ensureTeamButton.mockClear()

    document.body.append(document.createElement("div"))
    await observed()
    await nextFrame()

    expect(ensureTeamButton).toHaveBeenCalledOnce()
  })
})

describe("the on/off switch", () => {
  it("touches nothing at all while switched off", async () => {
    enabled = false
    cards.mockReturnValue([card("a")])
    await start()

    expect(injectFonts).not.toHaveBeenCalled()
    expect(addPill).not.toHaveBeenCalled()

    document.body.append(document.createElement("div"))
    await observed()
    expect(frame).toHaveLength(0) // not even watching the page
  })

  it("puts its buttons on the page as soon as it is switched on", async () => {
    enabled = false
    cards.mockReturnValue([card("a")])
    await start()

    flip(true)
    expect(injectFonts).toHaveBeenCalledOnce()
    expect(addPill).toHaveBeenCalledTimes(1)

    document.body.append(document.createElement("div"))
    await observed()
    await nextFrame()
    expect(addPill).toHaveBeenCalledTimes(2)
  })

  it("takes them off again, and stops watching, when it is switched off", async () => {
    cards.mockReturnValue([card("a")])
    await start()

    flip(false)
    expect(teardown).toHaveBeenCalledOnce()

    addPill.mockClear()
    document.body.append(document.createElement("div"))
    await observed()
    expect(frame).toHaveLength(0)
    expect(addPill).not.toHaveBeenCalled()
  })

  it("loads the fonts once, however often the switch is flipped", async () => {
    await start()
    flip(false)
    flip(true)
    flip(false)
    flip(true)
    expect(injectFonts).toHaveBeenCalledOnce()
  })
})
