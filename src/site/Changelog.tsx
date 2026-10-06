import { Fragment, type ReactNode } from "react"
import { Download } from "lucide-react"
import changelog from "../../CHANGELOG.md?raw"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { parseChangelog } from "./parse-changelog"
import { ExternalLink, SitePage } from "./layout"
import { REPO, zipName, zipUrl } from "./release"

const RELEASES = parseChangelog(changelog)

// `code` and **bold** are the only Markdown the changelog uses inline.
function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i} className="rounded bg-secondary px-1 text-[13px] text-foreground">{part.slice(1, -1)}</code>
    ) : part.startsWith("**") ? (
      <b key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</b>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

export default function Changelog() {
  const latest = RELEASES.find((r) => r.date)
  return (
    <SitePage home="./">
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[760px]">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">Changelog</p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">What's new</h1>
          <p className="mt-4 text-muted-foreground">
            Every release of SP Tool 27. Older builds stay on{" "}
            <ExternalLink href={`${REPO}/releases`} className="text-foreground underline underline-offset-4">GitHub Releases</ExternalLink>.
          </p>

          <ol className="mt-12 space-y-6">
            {RELEASES.map((r) => (
              <li key={r.version} id={`v${r.version}`} className="scroll-mt-20">
                <Card className="rounded-[18px] p-6 shadow-none sm:p-8">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className="font-display text-2xl font-bold tracking-wide">{r.date ? `v${r.version}` : r.version}</h2>
                    {r === latest && <Badge className="rounded-full font-display text-[10px] uppercase tracking-[0.12em] shadow-none">Latest</Badge>}
                    {r.date && <time dateTime={r.date} className="text-sm text-muted-foreground">{formatDate(r.date)}</time>}
                    {r.date && (
                      <a
                        href={zipUrl(r.version)}
                        className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                        aria-label={`Download ${zipName(r.version)}`}
                      >
                        <Download className="size-4" /> .zip
                      </a>
                    )}
                  </div>
                  {r.groups.map((g) => (
                    <div key={g.title} className="mt-6">
                      <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.title}</h3>
                      <ul className="mt-3 space-y-2.5">
                        {g.items.map((item) => (
                          <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                            <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{inline(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </SitePage>
  )
}
