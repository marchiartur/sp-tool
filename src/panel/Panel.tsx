import { useEffect, useState } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, LogIn, Minus, Plus, RotateCw, Search, WifiOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { down, fmt, parsePrice, snap, up } from "./price"
import type { Connection, Player, Queue, Status } from "./types"

export interface PanelProps {
  queue: Queue
  status: Status
  connection: Connection
  onRetry: () => void
  onGo: (index: number) => void                       // jump to a player and search
  onSearch: (max: number | null) => void              // search current player
  onSetMax: (defId: number, max: number | undefined) => void
  onRemove: (defId: number) => void
}

export const maxOf = (p: Player) =>
  p.maxBuy !== undefined ? p.maxBuy || null : p.price ? snap(p.price) : null

export function Panel({ queue, status, connection, onRetry, onGo, onSearch, onSetMax, onRemove }: PanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { players, index, done } = queue
  const current = players[index]
  const total = players.length
  const busy = status.kind === "searching"
  const blocked = connection !== "ready"

  return (
    <section
      aria-label="Player queue"
      className="w-[340px] overflow-hidden rounded-2xl border bg-card/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
    >
      {/* Header: team + progress */}
      <header className="flex items-center gap-3 py-2 pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold uppercase tracking-[0.08em]">{queue.team || "Queue"}</p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
            <div className="h-full rounded-full bg-foreground transition-all" style={{ width: total ? `${((index + 1) / total) * 100}%` : "0%" }} />
          </div>
        </div>
        <span className="font-display text-sm font-semibold tabular text-muted-foreground">
          <span className="text-foreground">{total ? index + 1 : 0}</span>/{total}
        </span>
        <Button variant="ghost" size="iconTouch" className="text-muted-foreground" aria-label={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed((c) => !c)}>
          <ChevronDown className={cn("transition-transform", collapsed && "rotate-180")} />
        </Button>
      </header>

      {!collapsed && <ConnectionBanner connection={connection} />}

      {!collapsed && !current && (
        <div className="flex flex-col items-center gap-1 border-t px-6 py-8 text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-wide">Queue is empty</p>
          <p className="text-xs text-muted-foreground">Click Queue team on a fut.gg gallery</p>
        </div>
      )}

      {!collapsed && current && (
        <>
          <Current key={current.defId} player={current} status={status} busy={busy} blocked={blocked} onRetry={onRetry} onSearch={onSearch} onSetMax={onSetMax} />

          {/* Prev / Next */}
          <div className="flex items-center gap-2 px-4 pb-4">
            <Button variant="outline" size="iconTouch" aria-label="Previous player" disabled={index === 0 || blocked} onClick={() => onGo(index - 1)}>
              <ChevronLeft />
            </Button>
            <Button
              variant="glow"
              size="touch"
              data-busy={busy}
              disabled={index >= total - 1 || blocked}
              className="flex-1 justify-between rounded-xl [--glow-fill:hsl(228_26%_9%)]"
              onClick={() => onGo(index + 1)}
            >
              <span className="truncate">{index < total - 1 ? players[index + 1].name : "Last player"}</span>
              <ChevronRight />
            </Button>
          </div>

          {/* Queue list */}
          <ol className="max-h-[220px] overflow-y-auto border-t py-1.5">
            {players.map((p, i) => {
              const isCurrent = i === index
              const isDone = done.includes(p.defId) && !isCurrent
              const max = maxOf(p)
              return (
                <li key={p.defId} className="group relative">
                  <button
                    type="button"
                    onClick={() => onGo(i)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "flex h-11 w-full items-center gap-3 pl-4 pr-12 text-left transition-colors hover:bg-accent",
                      isCurrent && "bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold tabular",
                        isCurrent && "border-foreground bg-foreground text-background",
                        isDone && "border-transparent bg-secondary text-muted-foreground",
                        !isCurrent && !isDone && "text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="size-3" /> : i + 1}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", isDone && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                      {p.name}
                    </span>
                    <span className="font-display text-sm tabular text-muted-foreground">{max ? fmt(max) : "—"}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${p.name}`}
                    className="absolute right-2 top-1/2 size-8 -translate-y-1/2 text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => onRemove(p.defId)}
                  >
                    <X />
                  </Button>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

function Current({
  player, status, busy, blocked, onRetry, onSearch, onSetMax,
}: { player: Player; status: Status; busy: boolean; blocked: boolean } & Pick<PanelProps, "onRetry" | "onSearch" | "onSetMax">) {
  const max = maxOf(player)
  const [draft, setDraft] = useState(max ? fmt(max) : "")
  useEffect(() => setDraft(max ? fmt(max) : ""), [max])
  // −/+ step from what's in the box right now (typed or saved)
  const base = (draft.trim() ? parsePrice(draft) : null) ?? max ?? 200

  const submit = () => {
    if (blocked || busy) return
    const v = draft.trim() ? parsePrice(draft) : 0
    if (v == null) return setDraft(max ? fmt(max) : "")
    onSetMax(player.defId, v)
    onSearch(v || null)
  }

  return (
    <div className="flex flex-col gap-3 border-t px-4 pb-3 pt-4">
      <div className="flex items-end justify-between gap-3">
        <a href={player.url} target="_blank" rel="noopener" className="min-w-0 truncate font-display text-[26px] font-bold uppercase leading-none tracking-wide text-foreground hover:underline">
          {player.name}
        </a>
        <span className="shrink-0 text-xs text-muted-foreground tabular">{player.price ? fmt(player.price) : "No price"}</span>
      </div>

      <div className="flex items-stretch gap-2">
        <Button variant="outline" aria-label="Lower price" className="h-14 w-11 shrink-0 rounded-xl" onClick={() => onSetMax(player.defId, down(base))}>
          <Minus />
        </Button>
        <Input
          aria-label={`Max Buy Now for ${player.name}`}
          inputMode="numeric"
          value={draft}
          placeholder="Any"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="h-14 min-w-0 flex-1 rounded-xl bg-background/60 text-center font-display text-[30px] font-bold tracking-wide text-primary tabular placeholder:text-muted-foreground"
        />
        <Button variant="outline" aria-label="Raise price" className="h-14 w-11 shrink-0 rounded-xl" onClick={() => onSetMax(player.defId, up(base))}>
          <Plus />
        </Button>
        <Button variant="glow" aria-label="Search" title="Search (Enter)" data-busy={busy} disabled={blocked} className="h-14 w-14 shrink-0 rounded-xl px-0 [--glow-fill:hsl(228_26%_9%)]" onClick={submit}>
          <Search className="!size-5" />
        </Button>
      </div>

      <StatusLine status={status} onRetry={onRetry} />
    </div>
  )
}

const BANNERS: Record<Exclude<Connection, "ready">, { icon: typeof WifiOff; text: string; spin?: boolean }> = {
  loading: { icon: Loader2, text: "Web App is loading", spin: true },
  loggedOut: { icon: LogIn, text: "Log in to the Web App" },
  offline: { icon: WifiOff, text: "No internet connection" },
  broken: { icon: AlertTriangle, text: "Web App changed, extension needs an update" },
}

function ConnectionBanner({ connection }: { connection: Connection }) {
  if (connection === "ready") return null
  const b = BANNERS[connection]
  const Icon = b.icon
  return (
    <div role="status" className="flex items-center gap-2.5 border-t bg-secondary/70 px-4 py-2.5 text-xs font-medium">
      <Icon className={cn("size-4 shrink-0", b.spin && "animate-spin", connection === "broken" && "text-destructive")} />
      {b.text}
    </div>
  )
}

function StatusLine({ status, onRetry }: { status: Status; onRetry: () => void }) {
  if (status.kind === "openFailed")
    return (
      <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">
        Couldn't open results
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-foreground" onClick={onRetry}>
          <RotateCw className="!size-3.5" /> Retry
        </Button>
      </div>
    )
  if (status.kind !== "searching") return null
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-70" />
        <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
      </span>
      Searching…
    </p>
  )
}
