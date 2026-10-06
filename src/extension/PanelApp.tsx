// The panel as it runs inside the Web App (React, extension isolated world).
// Queue lives in chrome.storage.local so every tab shows the same queue;
// only the tab where you click (or the one background.js picks) opens a search.
import { useCallback, useEffect, useRef, useState } from "react"
import { Panel, maxOf } from "@/panel/Panel"
import type { Connection, Player, Queue, Status } from "@/panel/types"

const FROM_MAIN = "futgg-ext-main"
const TO_MAIN = "futgg-ext"
const OPEN_TIMEOUT_MS = 6000
const EMPTY: Queue = { team: "", players: [], index: 0, done: [] }

type Health = Exclude<Connection, "offline">

const log = (...a: unknown[]) => console.info("[fut.gg extension]", ...a)
const toMain = (msg: object) => window.postMessage({ src: TO_MAIN, ...msg }, location.origin)

async function saveQueue(q: Queue) {
  try {
    await chrome.storage.local.set({ queue: q })
  } catch (err) {
    log("couldn't save queue", err)
  }
}

export function PanelApp() {
  const [queue, setQueue] = useState<Queue>(EMPTY)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [health, setHealth] = useState<Health>("loading")
  const [online, setOnline] = useState(navigator.onLine)

  const queueRef = useRef(queue)
  queueRef.current = queue
  const connection: Connection = !online ? "offline" : health
  const connectionRef = useRef(connection)
  connectionRef.current = connection
  const pendingOpen = useRef(false)
  const openTimer = useRef<number | undefined>(undefined)
  const heard = useRef(false)

  // ---------- open the current player in EA's results screen ----------
  const openCurrent = useCallback((override?: Queue) => {
    const q = override ?? queueRef.current
    const player = q.players[q.index]
    if (!player) return
    if (connectionRef.current !== "ready") {
      pendingOpen.current = true // runs as soon as the Web App is ready / back online
      return
    }
    pendingOpen.current = false
    setStatus({ kind: "searching" })
    toMain({ type: "OPEN", defId: player.defId, price: maxOf(player) })
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(() => setStatus({ kind: "openFailed" }), OPEN_TIMEOUT_MS)
    if (!q.done.includes(player.defId)) {
      const next = { ...q, done: [...q.done, player.defId] }
      setQueue(next)
      saveQueue(next)
    }
  }, [])

  // ---------- storage ----------
  useEffect(() => {
    chrome.storage.local.get("queue").then(({ queue: q }) => q && setQueue(q as Queue)).catch(() => {})
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes.queue) setQueue((changes.queue.newValue as Queue) ?? EMPTY)
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  // ---------- messages from ea-main.js (page context) ----------
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.data?.src !== FROM_MAIN) return
      const m = e.data
      if (m.type === "HEALTH") {
        heard.current = true
        setHealth(m.state as Health)
      }
      if (m.type === "OPENED") {
        window.clearTimeout(openTimer.current)
        setStatus({ kind: "open" })
      }
      if (m.type === "OPEN_FAILED") {
        window.clearTimeout(openTimer.current)
        log("open failed:", m.text)
        setStatus({ kind: "openFailed" })
      }
    }
    window.addEventListener("message", onMessage)
    toMain({ type: "PING" }) // ea-main may have reported health before we listened
    // ea-main reports within a couple of seconds; silence for 30 s means it never ran.
    const silence = window.setTimeout(() => setHealth((h) => (h === "loading" && !heard.current ? "broken" : h)), 30000)
    return () => {
      window.removeEventListener("message", onMessage)
      window.clearTimeout(silence)
    }
  }, [])

  // ---------- internet ----------
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  // ---------- requests from background.js (fut.gg clicks) ----------
  useEffect(() => {
    const onRuntime = (msg: { type?: string }, _s: unknown, reply: (r: unknown) => void) => {
      if (msg?.type !== "OPEN_CURRENT") return
      chrome.storage.local
        .get("queue")
        .then(({ queue: q }) => {
          if (q) {
            setQueue(q as Queue)
            queueRef.current = q as Queue
          }
          openCurrent(q as Queue)
          reply({ ok: true })
        })
        .catch((err) => {
          log("couldn't read queue", err)
          reply({ ok: false })
        })
      return true
    }
    chrome.runtime.onMessage.addListener(onRuntime)
    return () => chrome.runtime.onMessage.removeListener(onRuntime)
  }, [openCurrent])

  // ---------- when the connection becomes ready ----------
  const announced = useRef(false)
  useEffect(() => {
    if (connection !== "ready") return
    if (pendingOpen.current) openCurrent()
    if (!announced.current) {
      announced.current = true
      // This tab may have been opened by a fut.gg click before we loaded.
      chrome.runtime
        .sendMessage({ type: "PANEL_READY" })
        .then((res: { openCurrent?: boolean }) => res?.openCurrent && openCurrent())
        .catch(() => {})
    }
  }, [connection, openCurrent])

  // ---------- queue edits ----------
  const update = (q: Queue) => {
    setQueue(q)
    queueRef.current = q
    saveQueue(q)
  }
  const setMax = (defId: number, max: number | undefined) =>
    update({ ...queueRef.current, players: queueRef.current.players.map((p: Player) => (p.defId === defId ? { ...p, maxBuy: max } : p)) })

  return (
    <div className="fgx-root">
      <Panel
        queue={queue}
        status={status}
        connection={connection}
        onRetry={() => openCurrent()}
        onGo={(i) => {
          const q = queueRef.current
          if (!q.players[i]) return
          const next = { ...q, index: i }
          update(next)
          openCurrent(next)
        }}
        onSearch={() => openCurrent()}
        onSetMax={setMax}
        onRemove={(defId) => {
          const q = queueRef.current
          const removedIndex = q.players.findIndex((p) => p.defId === defId)
          if (removedIndex === -1) return
          const players = q.players.filter((p) => p.defId !== defId)
          const index = removedIndex < q.index ? q.index - 1 : Math.min(q.index, Math.max(0, players.length - 1))
          update({ ...q, players, index, done: q.done.filter((d) => d !== defId) })
        }}
        onClear={() => {
          window.clearTimeout(openTimer.current)
          pendingOpen.current = false
          setStatus({ kind: "idle" })
          update(EMPTY)
        }}
      />
    </div>
  )
}
