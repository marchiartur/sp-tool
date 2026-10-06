// Release links for the site. The page asks GitHub's API for the latest release once it
// loads and links straight to its sp-tool-27-vX.Y.Z.zip, so a new release shows up on the
// site without a redeploy. Until that answer arrives (or if the API is unreachable), the
// version comes from the extension's manifest and the button opens the latest release page.
import { useEffect, useState } from "react"
import manifest from "../../extension-static/manifest.json"

export const REPO = "https://github.com/marchiartur/sp-tool"
export const VERSION = manifest.version

export const zipName = (version: string) => `sp-tool-27-v${version}.zip`
export const zipUrl = (version: string) => `${REPO}/releases/download/v${version}/${zipName(version)}`

export type Latest = { version: string; url: string }
const FALLBACK: Latest = { version: VERSION, url: `${REPO}/releases/latest` }

// One request per page load, shared by every download button.
let request: Promise<Latest> | null = null
function fetchLatest(): Promise<Latest> {
  request ??= fetch("https://api.github.com/repos/marchiartur/sp-tool/releases/latest")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((release: { tag_name: string; assets: { name: string; browser_download_url: string }[] }) => {
      const version = release.tag_name.replace(/^v/, "")
      const zip = release.assets.find((a) => a.name === zipName(version))
      return zip ? { version, url: zip.browser_download_url } : { ...FALLBACK, version }
    })
    .catch(() => FALLBACK)
  return request
}

export function useLatestRelease(): Latest {
  const [latest, setLatest] = useState(FALLBACK)
  useEffect(() => {
    let live = true
    fetchLatest().then((l) => live && setLatest(l))
    return () => {
      live = false
    }
  }, [])
  return latest
}

// Set to the listing URL once the Chrome Web Store approves it; until then the button shows "Soon".
export const CHROME_WEB_STORE_URL: string | null = null
