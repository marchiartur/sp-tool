// Release links for the site. The version label comes from the extension's manifest;
// the download uses the stable zip name the release workflow attaches to every release,
// so GitHub's /releases/latest/ always serves the newest one without a site redeploy.
import manifest from "../../extension-static/manifest.json"

export const REPO = "https://github.com/marchiartur/sp-tool"
export const VERSION = manifest.version

export const zipName = (version: string) => `sp-tool-27-v${version}.zip`
export const zipUrl = (version: string) => `${REPO}/releases/download/v${version}/${zipName(version)}`
export const LATEST_ZIP = "sp-tool-27.zip"
export const DOWNLOAD_URL = `${REPO}/releases/latest/download/${LATEST_ZIP}`

// Set to the listing URL once the Chrome Web Store approves it; until then the button shows "Soon".
export const CHROME_WEB_STORE_URL: string | null = null
