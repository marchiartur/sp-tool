// Parses CHANGELOG.md ("## [version] - date", "### Group", "- item") for the changelog page.
export interface Release {
  version: string
  date: string | null
  groups: { title: string; items: string[] }[]
}

const RELEASE_RE = /^## \[([^\]]+)\](?:\s*-\s*(\S+))?/

export function parseChangelog(md: string): Release[] {
  const releases: Release[] = []
  for (const line of md.split(/\r?\n/)) {
    const release = releases.at(-1)
    const m = line.match(RELEASE_RE)
    if (m) releases.push({ version: m[1], date: m[2] ?? null, groups: [] })
    else if (release && line.startsWith("### ")) release.groups.push({ title: line.slice(4).trim(), items: [] })
    else if (release && line.startsWith("- ")) release.groups.at(-1)?.items.push(line.slice(2).trim())
  }
  return releases
}
