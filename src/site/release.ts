// Release links for the site, derived from the extension's manifest version.
// The release workflow names the zip the same way, so these always match a tag.
import manifest from "../../extension-static/manifest.json"

export const REPO = "https://github.com/marchiartur/sp-tool"
export const VERSION = manifest.version

export const zipName = (version: string) => `sp-tool-27-v${version}.zip`
export const zipUrl = (version: string) => `${REPO}/releases/download/v${version}/${zipName(version)}`
export const DOWNLOAD_URL = zipUrl(VERSION)

// Set to the listing URL once the Chrome Web Store approves it; until then the button shows "Soon".
export const CHROME_WEB_STORE_URL: string | null = null
