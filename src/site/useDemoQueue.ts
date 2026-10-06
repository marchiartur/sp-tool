// Local stand-in for the extension's queue, so pages can run the real Panel
// with placeholder players and no Web App behind it.
import { useRef, useState } from "react"
import type { Player, Queue, Status } from "@/panel/types"

// Made-up players for demos only.
export const DEMO_PLAYERS: Player[] = [
  { defId: 1, name: "Theo Marchetti", url: "#", price: 2600 },
  { defId: 2, name: "Kofi Adebayo", url: "#", price: 14250 },
  { defId: 3, name: "Lucas Ferreira", url: "#", price: null },
  { defId: 4, name: "Sam Whitlock", url: "#", price: 850 },
  { defId: 5, name: "Ivo Petrović", url: "#", price: 1200 },
  { defId: 6, name: "Noah Mensah", url: "#", price: 4300 },
  { defId: 7, name: "Ryan Okoro", url: "#", price: 650 },
]

export function useDemoQueue(initial: Queue) {
  const [queue, setQueue] = useState<Queue>(initial)
  const [status, setStatus] = useState<Status>({ kind: "open" })
  const timer = useRef<number | undefined>(undefined)

  const search = () => {
    setStatus({ kind: "searching" })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus({ kind: "open" }), 900)
  }

  const go = (i: number) => {
    setQueue((q) => (q.players[i] ? { ...q, index: i, done: [...new Set([...q.done, q.players[i].defId])] } : q))
    search()
  }

  const setMax = (defId: number, maxBuy: number | undefined) =>
    setQueue((q) => ({ ...q, players: q.players.map((p) => (p.defId === defId ? { ...p, maxBuy } : p)) }))

  const remove = (defId: number) =>
    setQueue((q) => {
      const removed = q.players.findIndex((p) => p.defId === defId)
      if (removed === -1) return q
      const players = q.players.filter((p) => p.defId !== defId)
      const index = removed < q.index ? q.index - 1 : Math.min(q.index, Math.max(0, players.length - 1))
      return { ...q, players, index, done: q.done.filter((d) => d !== defId) }
    })

  const clear = () => setQueue({ team: "", players: [], index: 0, done: [] })

  // Same rules as background.js: click opens the player now, Shift+click adds it to the end.
  const send = (player: Player, team: string, focus: boolean) => {
    setQueue((q) => {
      const players = [...q.players]
      let i = players.findIndex((p) => p.defId === player.defId)
      if (i === -1) {
        i = focus && players.length ? q.index + 1 : players.length
        players.splice(i, 0, player)
      }
      const fresh = q.players.length === 0
      const index = focus ? i : q.index
      return {
        team: fresh ? team : q.team,
        players,
        index,
        done: focus ? [...new Set([...(fresh ? [] : q.done), player.defId])] : fresh ? [] : q.done,
      }
    })
    if (focus) search()
  }

  const queueTeam = (team: string, players: Player[]) => {
    setQueue({ team, players, index: 0, done: [players[0].defId] })
    search()
  }

  return { queue, status, setStatus, search, go, setMax, remove, clear, send, queueTeam }
}
