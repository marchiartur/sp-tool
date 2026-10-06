// Mounts the React panel inside a Shadow DOM so EA's CSS and ours never collide.
import { createRoot } from "react-dom/client"
import css from "./panel.css?inline"
import { PanelApp } from "./PanelApp"

// Tailwind 4 registers its --tw-* variables with @property; they go to the document too.
const PROPERTY_RULE = /@property\s+[\w-]+\s*\{[^}]*\}/g
const propertyRules = css.match(PROPERTY_RULE) ?? []
const shadowCss = css.replace(PROPERTY_RULE, "")

const HOST_ID = "sp-tool-27"

// Fonts and @property must live in the document (they don't work inside a shadow root).
function injectDocumentStyles() {
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

function mount() {
  if (document.getElementById(HOST_ID)) return
  injectDocumentStyles()

  const host = document.createElement("div")
  host.id = HOST_ID
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;"
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = shadowCss
  shadow.appendChild(style)
  const root = document.createElement("div")
  shadow.appendChild(root)
  createRoot(root).render(<PanelApp />)
}

mount()
