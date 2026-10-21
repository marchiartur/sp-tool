import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { debug, send, type Outgoing } from "./bridge"

const PLAYER = { defId: 1, name: "Leno", url: "https://www.fut.gg/", price: 900 }
const MSG: Outgoing = { type: "SEND_PLAYER", player: PLAYER, team: "Fulham", focus: true }

/** As much of chrome.runtime as bridge.ts touches. */
type RuntimeStub = {
  id?: string
  lastError?: { message: string }
  sendMessage?: (msg: unknown, cb?: (r: unknown) => void) => unknown
}

/** A chrome.runtime stand-in whose sendMessage answers however a test wants. */
function stubRuntime(runtime: RuntimeStub | undefined) {
  vi.stubGlobal("chrome", { runtime })
}

/** Answers the callback with `res`, after setting lastError to `error`. */
const answering = (res: unknown, error?: { message: string }) => ({
  id: "abc",
  lastError: undefined as { message: string } | undefined,
  sendMessage(_msg: unknown, cb?: (r: unknown) => void) {
    this.lastError = error
    cb?.(res)
    this.lastError = undefined
  },
})

beforeEach(() => vi.stubGlobal("chrome", undefined))
afterEach(() => vi.unstubAllGlobals())

describe("send", () => {
  it("reports the extension as reloaded when this script is orphaned", async () => {
    stubRuntime(undefined)
    await expect(send(MSG)).resolves.toEqual({ ok: false, problem: "reloaded" })
  })

  it("reports it reloaded when the context was invalidated", async () => {
    stubRuntime(answering(undefined, { message: "Extension context invalidated." }))
    await expect(send(MSG)).resolves.toEqual({ ok: false, problem: "reloaded" })
  })

  it("reports the worker unreachable on any other error", async () => {
    stubRuntime(answering(undefined, { message: "Could not establish connection." }))
    await expect(send(MSG)).resolves.toEqual({ ok: false, problem: "unreachable" })
  })

  it.each([[{ ok: false }], [{}], [undefined]])("reports failure when the worker answers %j", async (res) => {
    stubRuntime(answering(res))
    await expect(send(MSG)).resolves.toEqual({ ok: false, problem: "failed" })
  })

  it("succeeds when the worker says so", async () => {
    stubRuntime(answering({ ok: true }))
    await expect(send(MSG)).resolves.toEqual({ ok: true })
  })

  it("reports it reloaded when sendMessage throws", async () => {
    stubRuntime({
      id: "abc",
      sendMessage: () => {
        throw new Error("Extension context invalidated.")
      },
    })
    await expect(send(MSG)).resolves.toEqual({ ok: false, problem: "reloaded" })
  })

  it("passes the message through untouched", async () => {
    const sendMessage = vi.fn((_msg: unknown, cb?: (r: unknown) => void) => cb?.({ ok: true }))
    stubRuntime({ id: "abc", sendMessage })
    await send(MSG)
    expect(sendMessage.mock.calls[0][0]).toEqual(MSG)
  })
})

describe("debug", () => {
  it("says nothing in a release build", () => {
    const sendMessage = vi.fn()
    stubRuntime({ id: "abc", sendMessage })
    debug("click Open", PLAYER)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("logs to the worker in a dev build, and survives a worker that isn't listening", async () => {
    const sendMessage = vi.fn(() => Promise.reject(new Error("no receiver")))
    stubRuntime({ id: "abc", sendMessage })
    // DEV is read once, when the module is evaluated: re-evaluate it as a dev build.
    vi.stubGlobal("__SP_DEV__", true)
    vi.resetModules()
    const { debug: devDebug } = await import("./bridge")
    expect(() => devDebug("click Open", PLAYER)).not.toThrow()
    expect(sendMessage).toHaveBeenCalledWith({
      type: "DEBUG_EVENT",
      source: "fut.gg",
      event: "click Open",
      data: PLAYER,
    })
  })
})
