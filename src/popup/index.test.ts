// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// The real popup, so renaming an id here without renaming it there fails the test.
import html from "../../extension-static/popup.html?raw"

let stored = true
let save: (on: boolean) => Promise<void> = async () => {}
let flip: (on: boolean) => void = () => {}
const setEnabled = vi.fn((on: boolean) => save(on))

vi.mock("@/lib/settings", () => ({
  isEnabled: async () => stored,
  setEnabled: (on: boolean) => setEnabled(on),
  onEnabledChange: (fn: (on: boolean) => void) => {
    flip = fn
    return () => {}
  },
}))

const toggle = () => document.getElementById("toggle")!
const state = () => document.getElementById("state")!.textContent
const hint = () => document.getElementById("hint")!.textContent
const off = () => document.body.classList.contains("is-off")

/** Loads popup.html and runs popup.js against it, as Chrome does when the popup opens. */
const open = async () => {
  // Without the stylesheet: happy-dom won't fetch it and throws if asked to.
  document.documentElement.innerHTML = html.replace(/<link[^>]*>/g, "")
  vi.resetModules()
  await import("./index")
  await new Promise((r) => setTimeout(r, 0)) // the first paint waits on storage
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = true
  save = async () => {}
  vi.stubGlobal("chrome", { runtime: { getManifest: () => ({ version: "1.0.1" }) } })
})
afterEach(() => vi.unstubAllGlobals())

describe("opening the popup", () => {
  it("shows the extension as on", async () => {
    await open()
    expect(state()).toBe("On")
    expect(toggle().getAttribute("aria-checked")).toBe("true")
    expect(off()).toBe(false)
    expect(hint()).toContain("fut.gg")
  })

  it("shows it as off when it has been switched off", async () => {
    stored = false
    await open()
    expect(state()).toBe("Off")
    expect(toggle().getAttribute("aria-checked")).toBe("false")
    expect(off()).toBe(true)
    expect(hint()).toContain("Nothing is added")
  })

  it("shows the installed version", async () => {
    await open()
    expect(document.getElementById("version")!.textContent).toBe("v1.0.1")
  })
})

describe("flipping the switch", () => {
  it("switches off on a click, and saves it", async () => {
    await open()
    toggle().click()
    expect(state()).toBe("Off")
    expect(off()).toBe(true)
    expect(setEnabled).toHaveBeenCalledWith(false)
  })

  it("switches back on with a second click", async () => {
    await open()
    toggle().click()
    toggle().click()
    expect(state()).toBe("On")
    expect(setEnabled).toHaveBeenLastCalledWith(true)
  })

  it("snaps back when the new state can't be saved", async () => {
    save = async () => {
      throw new Error("storage full")
    }
    await open()
    toggle().click()
    await new Promise((r) => setTimeout(r, 0))
    expect(state()).toBe("On")
    expect(off()).toBe(false)
  })

  it("follows a flip made somewhere else", async () => {
    await open()
    flip(false)
    expect(state()).toBe("Off")
    flip(true)
    expect(state()).toBe("On")
  })
})

describe("the issues link", () => {
  it("opens this project's GitHub issues, in a new tab that can't reach back", async () => {
    await open()
    const link = document.getElementById("issues")!
    expect(link.getAttribute("href")).toBe("https://github.com/marchiartur/sp-tool/issues")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
  })
})
