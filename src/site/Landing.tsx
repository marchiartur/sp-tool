import type { MouseEvent, ReactNode } from "react"
import { ArrowRight, Check, HeartPulse, Layers, ListPlus, MousePointerClick, Plus, ShieldCheck, Tag, X } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Panel } from "@/panel/Panel"
import { fmt } from "@/panel/price"
import type { Player } from "@/panel/types"
import { GetButtons, GitHubMark, SitePage } from "./layout"
import { REPO, VERSION, useLatestRelease, zipName } from "./release"
import { DEMO_PLAYERS, useDemoQueue } from "./useDemoQueue"

const TEAM = "Charlton"
const RATINGS: Record<number, number> = { 1: 84, 2: 86, 3: 83, 4: 81, 5: 85, 6: 84, 7: 82 }

export default function Landing() {
  return (
    <TooltipProvider delayDuration={150}>
      <SitePage home="">
        <Hero />
        <HowItWorks />
        <Features />
        <GallerySection />
        <ReadOnly />
        <Install />
        <Faq />
      </SitePage>
    </TooltipProvider>
  )
}

function SectionTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-11 max-w-2xl text-center">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-[38px] sm:leading-9">{title}</h2>
      {children && <p className="mt-4 text-muted-foreground">{children}</p>}
    </div>
  )
}

// ---------- hero with the live demo ----------

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-[radial-gradient(hsl(228_20%_13%)_1px,transparent_1px)] bg-size-[22px_22px]">
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Badge variant="outline" className="gap-2.5 rounded-full bg-card px-3.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Free · Open source · Read-only
          </Badge>
          <h1 className="mt-7 font-display text-[40px] font-bold uppercase leading-[1.02] tracking-wide sm:text-[68px]">
            Scout on fut.gg.
            <br />
            <span className="text-primary">Search in one click.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-7">
            <strong className="font-semibold text-foreground">Scouty Player 27</strong> puts an Open button on every fut.gg player card. One click opens
            that player in the FC 27 Web App Transfer Market, with Max Buy Now already set.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GetButtons />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            For Chrome, Edge, Brave and other Chromium browsers ·{" "}
            <a href="./changelog.html" className="underline underline-offset-4 hover:text-foreground">What's new in v{VERSION}</a>
          </p>
        </div>

        <Demo />
      </div>
    </section>
  )
}

function Demo() {
  const demo = useDemoQueue({ team: TEAM, players: DEMO_PLAYERS.slice(0, 3), index: 0, done: [DEMO_PLAYERS[0].defId] })

  return (
    <div className="mt-[72px]">
      <p className="mb-5 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <MousePointerClick className="size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Try it: click <b className="font-semibold text-foreground">Open</b>, Shift+click to queue, or queue the whole team.
        </span>
      </p>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <Window label="fut.gg" className="min-w-0 max-w-[580px] flex-[1_1_520px]">
          <Gallery onOpen={(p, e) => demo.send(p, TEAM, !e.shiftKey)} onQueueTeam={() => demo.queueTeam(TEAM, DEMO_PLAYERS)} />
        </Window>
        <Window label="FC 27 Web App" className="w-full max-w-[372px]">
          <div className="flex justify-center">
            <Panel
              queue={demo.queue}
              status={demo.status}
              connection="ready"
              onRetry={demo.search}
              onGo={demo.go}
              onSearch={demo.search}
              onSetMax={demo.setMax}
              onRemove={demo.remove}
              onClear={demo.clear}
            />
          </div>
        </Window>
      </div>
    </div>
  )
}

function Window({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-[18px] border bg-[hsl(228_26%_7%)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] ${className ?? ""}`}>
      <div className="flex h-9 items-center gap-1.5 border-b px-3.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="ml-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      </div>
      <div className="p-4 sm:p-[18px]">{children}</div>
    </div>
  )
}

function Gallery({ onOpen, onQueueTeam }: { onOpen: (p: Player, e: MouseEvent) => void; onQueueTeam: () => void }) {
  return (
    <div>
      <div className="mb-[18px] flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold uppercase tracking-wide">{TEAM}</p>
          <p className="text-xs text-muted-foreground">{DEMO_PLAYERS.length} players</p>
        </div>
        <Button variant="glow" size="touch" className="rounded-full text-xs [--glow-fill:hsl(228_26%_7%)]" onClick={onQueueTeam}>
          <ListPlus /> Queue team <span className="rounded-full bg-accent px-1.5 text-[11px] tabular">{DEMO_PLAYERS.length}</span>
        </Button>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-[26px] pb-3 sm:grid-cols-3">
        {DEMO_PLAYERS.slice(0, 6).map((p) => (
          <li key={p.defId} className="relative flex flex-col items-center gap-1.5 rounded-[14px] border bg-[hsl(230_30%_5%)] px-2 pb-[26px] pt-4">
            <span className="font-display text-[22px] font-bold leading-none text-primary tabular">{RATINGS[p.defId]}</span>
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-secondary font-display text-sm font-bold text-muted-foreground">
              {p.name.split(" ").map((w) => w[0]).join("")}
            </span>
            <span className="max-w-full truncate text-xs font-semibold">{p.name}</span>
            <span className="flex items-center gap-1.5 font-display text-xs font-semibold text-muted-foreground tabular">
              <span aria-hidden className="size-[9px] rounded-full bg-primary" />
              {p.price ? fmt(p.price) : "—"}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="glow"
                  size="sm"
                  aria-label={`Open ${p.name}`}
                  className="absolute -bottom-4 left-1/2 h-8 -translate-x-1/2 gap-1 rounded-full px-3 text-[11px] [--glow-fill:hsl(230_30%_6%)] [&_svg]:size-3"
                  onClick={(e) => onOpen(p, e)}
                >
                  Open <ArrowRight className="-rotate-45" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shift+click: add to queue</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- how it works ----------

const STEPS = [
  { n: "01", title: "Scout on fut.gg", body: "Browse any gallery or player list. Every card gets an Open button, and gallery pages get Queue team." },
  { n: "02", title: "Click Open", body: "The Web App jumps to the Transfer Market search for that player, with Max Buy Now set from the fut.gg price." },
  { n: "03", title: "Buy it yourself", body: "Step through the queue with Next, tweak the price, and make every purchase with your own click." },
]

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 border-t px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionTitle kicker="How it works" title="Three steps, no copy-paste" />
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Card className="h-full rounded-2xl p-7 shadow-none">
                <span className="font-display text-[40px] font-bold leading-none text-primary tabular">{s.n}</span>
                <h3 className="mt-5 font-display text-lg font-bold uppercase tracking-wide">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------- features ----------

const FEATURES = [
  { icon: Tag, title: "Max Buy Now, preset", body: "Uses the price on the fut.gg card, snapped to EA's price steps." },
  { icon: ListPlus, title: "Queue a whole team", body: "One click queues every player on a gallery page. Jump to any of them." },
  { icon: Plus, title: "Adjust in one tap", body: "− and + follow the market's price steps. Or type 2.6k or 1.5m." },
  { icon: HeartPulse, title: "Knows when to wait", body: "Tells you when the Web App is loading, logged out, offline or changed by an EA update." },
  { icon: Layers, title: "One queue, every tab", body: "The queue is shared between tabs, and only one Web App tab runs the search." },
  { icon: ShieldCheck, title: "Nothing leaves your browser", body: "No server, no account, no analytics. Your queue stays in Chrome's local storage." },
]

function Features() {
  return (
    <section className="border-t px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionTitle kicker="Features" title="Built for SBC grinders" />
        <ul className="grid gap-px overflow-hidden rounded-[18px] border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-card p-7">
              <Icon className="size-[22px] text-primary" aria-hidden />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ---------- FUT Gallery use case ----------

const GALLERY_FLOW = [
  { title: "Open a Gallery set on fut.gg", body: "Club, league or rarity sets list every player with its price." },
  { title: "Queue team", body: "Every player in the set lands in the panel, in order." },
  { title: "Check each value in the market", body: "Each search opens with Max Buy Now preset, so overpriced listings are already filtered out." },
  { title: "Buy, collect, sell back", body: "The Gallery keeps a player once it has been in your club, so you can relist it after." },
]

function GallerySection() {
  return (
    <section id="gallery" className="scroll-mt-16 border-t px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">FUT Gallery</p>
          <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-[38px] sm:leading-9">Fill Gallery sets faster</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            FC 27's FUT Gallery rewards you for every player that passes through your club: complete a set, raise its grade and earn Gallery
            Tokens for Hall of FUT players. Most of the work is checking what each player in a set costs. SP Tool 27 turns a fut.gg Gallery set
            into a queue, so you can price-check the whole set in the Transfer Market in a few clicks.
          </p>
        </div>
        <Card className="rounded-[18px] p-6 shadow-none sm:p-8">
          <ol className="space-y-5">
            {GALLERY_FLOW.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-input font-display text-xs font-semibold tabular">{i + 1}</span>
                <div className="pt-0.5">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </section>
  )
}

// ---------- read-only promise ----------

const DOES = ["Reads the fut.gg page you have open", "Fills in EA's own Transfer Market search", "Keeps your queue in your browser"]
const NEVER = ["Buys, bids or lists anything", "Reads your club, coins or EA account", "Sends data to any server"]

function ReadOnly() {
  const list = (title: string, items: string[], good: boolean) => (
    <Card className="rounded-2xl p-7 shadow-none">
      <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <ul className="mt-[18px] space-y-3.5">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3 text-[15px]">
            {good ? <Check className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden /> : <X className="mt-0.5 size-[18px] shrink-0 text-destructive" aria-hidden />}
            {t}
          </li>
        ))}
      </ul>
    </Card>
  )
  return (
    <section id="read-only" className="scroll-mt-16 border-t px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[900px]">
        <SectionTitle kicker="Read-only by design" title="Every purchase is your click">
          SP Tool 27 only opens a search screen. It has no code that trades, and the source is open for anyone to check.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {list("What it does", DOES, true)}
          {list("What it never does", NEVER, false)}
        </div>
      </div>
    </section>
  )
}

// ---------- install ----------

function LatestZipName() {
  return zipName(useLatestRelease().version)
}
const b = (text: ReactNode) => <b className="font-semibold text-foreground">{text}</b>
const INSTALL: ReactNode[] = [
  <>Download {b(<LatestZipName />)} from GitHub Releases and unzip it.</>,
  <>
    Open <code className="rounded-md bg-secondary px-1.5 py-0.5 text-sm text-foreground">chrome://extensions</code> and turn on {b("Developer mode")}.
  </>,
  <>Click {b("Load unpacked")} and pick the unzipped folder.</>,
  <>Open the FC 27 Web App, log in, then click Open on any fut.gg card.</>,
]

function Install() {
  return (
    <section id="install" className="scroll-mt-16 border-t px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[760px]">
        <SectionTitle kicker="Install" title="Ready in a minute" />
        <Card className="rounded-[18px] p-6 shadow-none sm:p-8">
          <ol className="space-y-5">
            {INSTALL.map((step, i) => (
              <li key={i} className="flex gap-4 leading-normal text-muted-foreground">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-input font-display text-xs font-semibold text-foreground tabular">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <Separator className="my-7" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <GetButtons size="touch" />
            </div>
            <p className="text-[13px] text-muted-foreground">
              One-click install from the Chrome Web Store is coming soon. Prefer to build it yourself?{" "}
              <a href={`${REPO}#install-from-source`} className="text-foreground underline underline-offset-4">Build from source</a>
            </p>
          </div>
        </Card>
      </div>
    </section>
  )
}

// ---------- FAQ ----------

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is it safe for my EA account?",
    a: "SP Tool 27 never trades or automates anything: it opens the same search screen you would open by hand. EA's terms still discourage third-party tools with the Web App, so use it at your own risk.",
  },
  { q: "What does SP stand for?", a: "Scouty Player. You scout players on fut.gg, and it takes them straight to the market. The 27 is for FC 27." },
  {
    q: "Does it help with the FUT Gallery?",
    a: "Yes. Open any FC 27 FUT Gallery set on fut.gg, click Queue team, and check every player's Transfer Market price one after another. The Gallery records a player once it has been in your club (loan players don't count), so you can sell it back afterwards. Buying and selling stay manual.",
  },
  { q: "Does it cost anything?", a: "No. It's free and open source under the MIT license." },
  {
    q: "It stopped working after an EA update.",
    a: (
      <>
        The panel shows “Web App changed” when EA moves things around. Please{" "}
        <a href={`${REPO}/issues/new/choose`} className="text-foreground underline underline-offset-4">open an issue</a> and paste the line starting with{" "}
        <code className="rounded bg-secondary px-1 text-foreground">[fut.gg extension]</code> from the browser console.
      </>
    ),
  },
  { q: "Does it work in Firefox or Safari?", a: "Not yet. It runs in Chrome, Edge, Brave and other Chromium browsers. Firefox support is planned." },
  { q: "Is it made by EA or fut.gg?", a: "No. It's an independent fan project, not affiliated with or endorsed by Electronic Arts or fut.gg." },
]

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[760px]">
        <SectionTitle kicker="FAQ" title="Questions" />
        <Accordion type="single" collapsible defaultValue={FAQ[0].q} className="rounded-[18px] border bg-card px-6">
          {FAQ.map(({ q, a }) => (
            <AccordionItem key={q} value={q} className="last:border-b-0">
              <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          More questions?{" "}
          <a href={REPO} className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4">
            <GitHubMark className="size-3.5" /> Ask on GitHub
          </a>
        </p>
      </div>
    </section>
  )
}
