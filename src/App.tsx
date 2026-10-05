import { useState } from "react"
import { ArrowUpRight, ListPlus } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Panel } from "@/panel/Panel"
import type { Connection, Player, Queue, Status } from "@/panel/types"

// Placeholder players for the preview only.
const TEAM: Player[] = [
  { defId: 1, name: "Theo Marchetti", url: "#", price: 2600 },
  { defId: 2, name: "Kofi Adebayo", url: "#", price: 14100 },
  { defId: 3, name: "Lucas Ferreira", url: "#", price: null },
  { defId: 4, name: "Sam Whitlock", url: "#", price: 850 },
  { defId: 5, name: "Ivo Petrović", url: "#", price: 1200 },
  { defId: 6, name: "Noah Mensah", url: "#", price: 4300 },
  { defId: 7, name: "Ryan Okoro", url: "#", price: 650 },
]

// Preview-only: switch between the states the extension can be in.
const SCENARIOS = [
  ["ok", "Normal"],
  ["loading", "Web App loading"],
  ["loggedOut", "Logged out"],
  ["offline", "Offline"],
  ["broken", "Web App changed"],
  ["openFailed", "Open failed"],
  ["empty", "Empty queue"],
  ["extUpdated", "fut.gg: extension updated"],
  ["noPlayers", "fut.gg: no players"],
] as const
type Scenario = (typeof SCENARIOS)[number][0]

export default function App() {
  const [queue, setQueue] = useState<Queue>({ team: "Charlton", players: TEAM, index: 1, done: [1] })
  const [status, setStatus] = useState<Status>({ kind: "open" })
  const [scenario, setScenario] = useState<Scenario>("ok")

  const connection: Connection =
    scenario === "loading" || scenario === "loggedOut" || scenario === "offline" || scenario === "broken" ? scenario : "ready"
  const shownStatus: Status = scenario === "openFailed" ? { kind: "openFailed" } : status
  const shownQueue: Queue = scenario === "empty" ? { team: "", players: [], index: 0, done: [] } : queue
  const toast =
    scenario === "extUpdated" ? "Extension updated. Refresh this page." : scenario === "noPlayers" ? "No players found on this page" : null

  const search = () => {
    setStatus({ kind: "searching" })
    setTimeout(() => setStatus({ kind: "open" }), 1200)
  }
  const go = (i: number) => {
    setQueue((q) => (q.players[i] ? { ...q, index: i, done: Array.from(new Set([...q.done, q.players[i].defId])) } : q))
    search()
  }
  const updatePlayer = (defId: number, patch: Partial<Player>) =>
    setQueue((q) => ({ ...q, players: q.players.map((p) => (p.defId === defId ? { ...p, ...patch } : p)) }))
  const remove = (defId: number) =>
    setQueue((q) => {
      const players = q.players.filter((p) => p.defId !== defId)
      return { ...q, players, index: Math.max(0, Math.min(q.index, players.length - 1)) }
    })

  return (
    <TooltipProvider delayDuration={200}>
      <main className="min-h-full w-full bg-background bg-[radial-gradient(hsl(228_20%_13%)_1px,transparent_1px)] [background-size:22px_22px] px-6 py-8">
        {/* Preview-only state switcher */}
        <div className="mx-auto mb-10 flex max-w-[1100px] flex-col gap-2">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview state</p>
          <ToggleGroup type="single" value={scenario} onValueChange={(v) => v && setScenario(v as Scenario)} className="flex flex-wrap justify-start gap-1.5">
            {SCENARIOS.map(([v, label]) => (
              <ToggleGroupItem key={v} value={v} className="h-8 rounded-full border px-3 text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mx-auto flex max-w-[1100px] flex-wrap items-start justify-center gap-12">
          {/* fut.gg gallery */}
          <div className="relative flex w-[460px] max-w-full flex-col gap-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-3">
              <div>
                <p className="font-display text-lg font-bold uppercase tracking-wide">Charlton</p>
                <p className="text-xs text-muted-foreground">7 players</p>
              </div>
              <Button variant="glow" size="touch" className="rounded-full [--glow-fill:hsl(228_26%_8%)]">
                <ListPlus /> Queue team
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative grid h-[190px] place-items-center rounded-xl border bg-card">
                  <div className="flex flex-col items-center gap-2">
                    <div className="size-16 rounded-full bg-secondary" />
                    <div className="h-2 w-16 rounded-full bg-secondary" />
                    <p className="font-display text-xs font-bold text-primary tabular">{["2.6K", "14.1K", "—"][i]}</p>
                  </div>
                  {i === 0 && (
                    <Button variant="glow" size="sm" className="absolute -bottom-4 left-1/2 h-9 -translate-x-1/2 rounded-full px-3 text-[11px] [--glow-fill:hsl(230_30%_6%)]">
                      Open <ArrowUpRight />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {toast && (
              <div role="status" className="glow-border mx-auto mt-4 rounded-xl px-4 py-3 text-sm font-medium [--glow-fill:hsl(228_26%_10%)]">
                {toast}
              </div>
            )}
          </div>

          {/* Web App */}
          <Panel
            queue={shownQueue}
            status={shownStatus}
            connection={connection}
            onRetry={() => { setScenario("ok"); search() }}
            onGo={go}
            onSearch={search}
            onSetMax={(id, max) => updatePlayer(id, { maxBuy: max })}
            onRemove={remove}
          />
        </div>
      </main>
    </TooltipProvider>
  )
}
