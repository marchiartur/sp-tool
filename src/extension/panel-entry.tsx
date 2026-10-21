// Mounts the React panel inside a Shadow DOM so EA's CSS and ours never collide.
// Mounts nothing while the extension is switched off in the toolbar popup, and takes the
// panel off this page the moment it is switched off.
import { createRoot, type Root } from "react-dom/client"
import { isEnabled, onEnabledChange } from "@/lib/settings"
import css from "./panel.css?inline"
import { PanelApp, TO_MAIN } from "./PanelApp"

// Tailwind 4 registers its --tw-* variables with @property; they go to the document too.
const PROPERTY_RULE = /@property\s+[\w-]+\s*\{[^}]*\}/g
const propertyRules = css.match(PROPERTY_RULE) ?? []
const shadowCss = css.replace(PROPERTY_RULE, "")

const HOST_ID = "sp-tool-27"

// Fonts and @property must live in the document (they don't work inside a shadow root).
let styled = false
function injectDocumentStyles() {
  if (styled) return
  styled = true // one @font-face block per page, however often the switch is flipped
  const font = (family: string, file: string, weight: number) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:swap;src:url("${chrome.runtime.getURL(`fonts/${file}`)}") format("woff2")}`
  const style = document.createElement("style")
  style.textContent = [
    font("Chakra Petch", "chakra-petch-500.woff2", 500),
    font("Chakra Petch", "chakra-petch-600.woff2", 600),
    font("Chakra Petch", "chakra-petch-700.woff2", 700),
    font("Figtree", "figtree-400.woff2", 400),
    font("Figtree", "figtree-500.woff2", 500),
    font("Figtree", "figtree-600.woff2", 600),
    font("Figtree", "figtree-700.woff2", 700),
    '@property --angle{syntax:"<angle>";initial-value:0deg;inherits:false}',
    ...propertyRules,
  ].join("\n")
  document.head.appendChild(style)
}

let root: Root | null = null

function mount() {
  if (root || document.getElementById(HOST_ID)) return
  injectDocumentStyles()

  const host = document.createElement("div")
  host.id = HOST_ID
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;"
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = shadowCss
  shadow.appendChild(style)
  const el = document.createElement("div")
  shadow.appendChild(el)
  root = createRoot(el)
  root.render(<PanelApp />)
}

function unmount() {
  root?.unmount()
  root = null
  document.getElementById(HOST_ID)?.remove()
}

// ea-main.js runs in the page's own context, where there is no extension storage to read:
// it polls the Web App's health until we tell it the switch has been turned off.
const tellPage = (on: boolean) => window.postMessage({ src: TO_MAIN, type: "ENABLED", on }, location.origin)

isEnabled().then((on) => {
  tellPage(on)
  if (on) mount()
})

onEnabledChange((on) => {
  tellPage(on)
  if (on) mount()
  else unmount()
})
