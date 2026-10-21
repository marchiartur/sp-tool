import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isEnabled, onEnabledChange, setEnabled } from "./settings"

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void

const set = vi.fn(async () => {})
const listeners: Listener[] = []
const removed: Listener[] = []

/** As much of chrome.storage as settings.ts touches; `stored` is what local.get answers. */
function stubStorage(stored: Record<string, unknown> | "unreadable") {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async () => {
          if (stored === "unreadable") throw new Error("no storage")
          return stored
        },
        set,
      },
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => removed.push(l),
      },
    },
  })
}

const flip = (changes: Record<string, { newValue?: unknown }>, area = "local") =>
  listeners.forEach((l) => l(changes, area))

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0
  removed.length = 0
})
afterEach(() => vi.unstubAllGlobals())

describe("isEnabled", () => {
  it("is on before anyone has touched the switch", async () => {
    stubStorage({})
    await expect(isEnabled()).resolves.toBe(true)
  })

  it("is off once it has been switched off", async () => {
    stubStorage({ enabled: false })
    await expect(isEnabled()).resolves.toBe(false)
  })

  it("is on when storage says so", async () => {
    stubStorage({ enabled: true })
    await expect(isEnabled()).resolves.toBe(true)
  })

  it("stays on when storage can't be read, rather than switching itself off", async () => {
    stubStorage("unreadable")
    await expect(isEnabled()).resolves.toBe(true)
  })
})

describe("setEnabled", () => {
  it.each([[true], [false]])("writes %s to storage", async (on) => {
    stubStorage({})
    await setEnabled(on)
    expect(set).toHaveBeenCalledWith({ enabled: on })
  })
})

describe("onEnabledChange", () => {
  it("reports a flip in either direction", () => {
    stubStorage({})
    const saw: boolean[] = []
    onEnabledChange((on) => saw.push(on))
    flip({ enabled: { newValue: false } })
    flip({ enabled: { newValue: true } })
    expect(saw).toEqual([false, true])
  })

  it("ignores changes to anything else, and to other storage areas", () => {
    stubStorage({})
    const fn = vi.fn()
    onEnabledChange(fn)
    flip({ queue: { newValue: {} } })
    flip({ enabled: { newValue: false } }, "session")
    expect(fn).not.toHaveBeenCalled()
  })

  it("stops listening when unsubscribed", () => {
    stubStorage({})
    const fn = vi.fn()
    onEnabledChange(fn)()
    expect(removed).toEqual(listeners)
  })
})
