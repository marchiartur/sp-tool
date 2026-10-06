import type { ReactNode } from "react"
import { ExternalLink, SitePage } from "./layout"
import { REPO } from "./release"

const UPDATED = "October 6, 2026"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}

export default function Privacy() {
  return (
    <SitePage home="./">
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[760px]">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">Privacy</p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">Privacy policy</h1>
          <p className="mt-4 text-muted-foreground">Last updated {UPDATED}.</p>

          <Section title="In short">
            <p className="text-foreground">SP Tool 27 does not collect, send, sell or share any personal data.</p>
          </Section>

          <Section title="What it stores">
            <p>
              Your player queue (player names, fut.gg links and prices, and the Max Buy Now values you set) is saved in your browser with the
              extension storage API, so it survives a reload and shows up in the Web App tab. It never leaves your device. Clearing the queue or
              removing the extension deletes it.
            </p>
          </Section>

          <Section title="What it sends">
            <p>
              Nothing. The extension makes no network requests of its own and has no analytics, tracking or ads. It has no servers and no
              accounts.
            </p>
            <p>
              When you click to search, it fills in the EA SPORTS FC Web App's own Transfer Market search. That search goes to EA exactly as if
              you had typed it yourself, under EA's own privacy policy.
            </p>
          </Section>

          <Section title="Where it runs">
            <p>Only on www.fut.gg and the EA SPORTS FC Web App on www.ea.com. It reads the player name and price on the fut.gg card you click.</p>
          </Section>

          <Section title="Changes and questions">
            <p>
              Any change to this policy will be posted on this page. The source code is public, so you can check all of the above on{" "}
              <ExternalLink href={REPO} className="text-foreground underline underline-offset-4">GitHub</ExternalLink>. Questions go to{" "}
              <ExternalLink href={`${REPO}/issues`} className="text-foreground underline underline-offset-4">GitHub Issues</ExternalLink>.
            </p>
          </Section>
        </div>
      </section>
    </SitePage>
  )
}
