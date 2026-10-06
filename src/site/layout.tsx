// Header, footer and brand marks shared by the site's pages.
import type { ComponentProps, ReactNode } from "react"
import { Download, Heart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CHROME_WEB_STORE_URL, REPO, SPONSOR_URL, useLatestRelease } from "./release"

/** The SP/27 tile: Chakra Petch Bold outlines in the Night Match gold and foreground, on the page background. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <rect x="1" y="1" width="62" height="62" rx="14" fill="#07080e" stroke="hsl(228 20% 24%)" strokeWidth="2" />
      <path fill="hsl(var(--primary))" d="M15.97 29.25L12.51 25.79L12.51 22.59L16.80 22.59L16.80 24.48L17.86 25.54L24.48 25.54L25.57 24.45L25.57 20.74L24.51 19.68L16.03 19.68L12.58 16.23L12.58 10.31L16.03 6.85L26.14 6.85L29.60 10.31L29.60 13.54L25.31 13.54L25.31 11.62L24.26 10.56L17.92 10.56L16.86 11.62L16.86 14.91L17.92 15.97L26.40 15.97L29.86 19.43L29.86 25.73L26.34 29.25L15.97 29.25ZM34.02 29.25L34.02 6.85L48.06 6.85L51.49 10.31L51.49 18.15L48.03 21.63L38.37 21.63L38.37 29.25L34.02 29.25ZM38.37 17.99L46.08 17.99L47.20 16.87L47.20 11.62L46.08 10.50L38.37 10.50L38.37 17.99Z" />
      <path fill="hsl(var(--foreground))" d="M15.23 57.15L15.23 52.25L26.75 41.79L26.75 39.52L25.70 38.46L20.51 38.46L19.46 39.52L19.46 41.79L15.10 41.79L15.10 38.21L18.56 34.75L27.65 34.75L31.10 38.21L31.10 43.07L19.74 53.18L19.74 53.50L31.23 53.50L31.23 57.15L15.23 57.15ZM35.30 57.15L44.35 38.75L44.35 38.46L33.15 38.46L33.15 34.75L48.90 34.75L48.90 38.85L39.90 57.15L35.30 57.15Z" />
    </svg>
  )
}

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** A link to another site: opens in a new tab, without giving that site access to this page. */
export function ExternalLink({ children, ...props }: ComponentProps<"a">) {
  return (
    <a target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** Zip download (always available) plus the Chrome Web Store button, shown as "Soon" until the listing exists. */
export function GetButtons({ size = "xl" }: { size?: "xl" | "touch" }) {
  const shape = size === "xl" ? "rounded-xl" : "rounded-xl text-[13px]"
  const latest = useLatestRelease()
  return (
    <>
      <Button asChild variant="glow" size={size} className={`${shape} [--glow-fill:hsl(230_30%_6%)]`}>
        <a href={latest.url}>
          <Download /> Download v{latest.version}
        </a>
      </Button>
      {CHROME_WEB_STORE_URL ? (
        <Button asChild variant="outline" size={size} className={`${shape} bg-transparent`}>
          <ExternalLink href={CHROME_WEB_STORE_URL}>Add to Chrome</ExternalLink>
        </Button>
      ) : (
        <Button variant="outline" size={size} disabled className={`${shape} bg-transparent disabled:opacity-60`}>
          Chrome Web Store
          <Badge className={`rounded-full px-2 py-0 font-display text-[10px] uppercase tracking-[0.12em] shadow-none ${size === "xl" ? "leading-6" : "leading-[22px]"}`}>Soon</Badge>
        </Button>
      )}
    </>
  )
}

/** `home` is "" on the landing page and "./" elsewhere, so section links work from every page. */
export function SiteHeader({ home }: { home: string }) {
  const link = "hover:text-foreground"
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href={`${home}#top`} className="flex items-center gap-2.5" aria-label="SP Tool 27 home">
          <Logo className="size-8" />
          <span className="font-display text-lg font-bold uppercase tracking-wider">SP Tool 27</span>
        </a>
        <nav aria-label="Sections" className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href={`${home}#how`} className={link}>How it works</a>
          <a href={`${home}#read-only`} className={link}>Read-only</a>
          <a href={`${home}#install`} className={link}>Install</a>
          <a href={`${home}#faq`} className={link}>FAQ</a>
          <a href="./changelog.html" className={link}>Changelog</a>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="ghost" size="iconTouch" aria-label="Source on GitHub (opens in a new tab)">
            <ExternalLink href={REPO}>
              <GitHubMark className="size-5!" />
            </ExternalLink>
          </Button>
          <Button asChild variant="glow" size="sm" className="hidden rounded-lg sm:inline-flex [--glow-fill:hsl(230_30%_5%)]">
            <a href={`${home}#install`}>Get it</a>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const link = "hover:text-foreground"
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="font-display font-bold uppercase tracking-wider">SP Tool 27</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Scouty Player 27 is not affiliated with, endorsed by, or connected to Electronic Arts, EA SPORTS FC or fut.gg. All trademarks belong to
            their respective owners.
          </p>
        </div>
        <nav aria-label="Project" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a href="./changelog.html" className={link}>Changelog</a>
          <a href="./privacy.html" className={link}>Privacy</a>
          <ExternalLink href={REPO} className={link}>GitHub</ExternalLink>
          <ExternalLink href={`${REPO}/issues`} className={link}>Issues</ExternalLink>
          <ExternalLink href={`${REPO}/blob/main/LICENSE`} className={link}>MIT License</ExternalLink>
          <ExternalLink href={SPONSOR_URL} className={`${link} inline-flex items-center gap-1.5`}>
            <Heart className="size-3.5 text-primary" aria-hidden /> Sponsor
          </ExternalLink>
        </nav>
      </div>
    </footer>
  )
}

export function SitePage({ home, children }: { home: string; children: ReactNode }) {
  return (
    <div className="min-h-full bg-background">
      <SiteHeader home={home} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}
