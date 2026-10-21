// Talking to the background worker. Transport only: what a failure should say is the
// UI's business, so failures come back named rather than shown.
import type { Player } from "@/panel/types"

/** Set by vite.ext.config.ts: true in `pnpm dev:ext` builds, false (and tree-shaken) in releases. */
export const DEV = __SP_DEV__

export type Outgoing =
  | { type: "SEND_PLAYER"; player: Player; team: string; focus: boolean }
  | { type: "QUEUE_TEAM"; team: string; players: Player[] }

export type SendProblem =
  | "reloaded" // the extension was updated or reloaded; this page's script is orphaned
  | "unreachable" // the worker didn't answer
  | "failed" // it answered, but couldn't do it

export type SendResult = { ok: true } | { ok: false; problem: SendProblem }

const RELOADED = { ok: false, problem: "reloaded" } as const

/** Dev builds: events go to the debug log (debug.html) in the background worker. */
export function debug(event: string, data: unknown): void {
  if (!DEV || !chrome.runtime?.id) return
  chrome.runtime.sendMessage({ type: "DEBUG_EVENT", source: "fut.gg", event, data }).catch(() => {})
}

export function send(msg: Outgoing): Promise<SendResult> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) return resolve(RELOADED)
    try {
      chrome.runtime.sendMessage(msg, (res?: { ok?: boolean }) => {
        const err = chrome.runtime.lastError
        if (err) {
          const orphaned = /context invalidated/i.test(err.message ?? "")
          return resolve({ ok: false, problem: orphaned ? "reloaded" : "unreachable" })
        }
        resolve(res?.ok ? { ok: true } : { ok: false, problem: "failed" })
      })
    } catch {
      resolve(RELOADED)
    }
  })
}
