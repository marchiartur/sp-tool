import { describe, expect, it } from "vitest"
import changelog from "../../CHANGELOG.md?raw"
import manifest from "../../extension-static/manifest.json"
import { parseChangelog } from "./parse-changelog"

describe("parseChangelog", () => {
  it("reads releases, groups and items", () => {
    const md = "# Changelog\nintro\n\n## [Unreleased]\n### Fixed\n- a\n\n## [1.0.1] - 2026-11-01\n### Added\n- b\n- c\n### Fixed\n- d\n"
    expect(parseChangelog(md)).toEqual([
      { version: "Unreleased", date: null, groups: [{ title: "Fixed", items: ["a"] }] },
      { version: "1.0.1", date: "2026-11-01", groups: [{ title: "Added", items: ["b", "c"] }, { title: "Fixed", items: ["d"] }] },
    ])
  })

  it("has an entry for the manifest version, so the release has notes", () => {
    expect(parseChangelog(changelog).map((r) => r.version)).toContain(manifest.version)
  })
})
