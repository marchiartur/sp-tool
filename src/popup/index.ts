// The toolbar popup (popup.html): one switch that turns the extension on and off.
// Nothing else lives here — the switch is the whole page.
import { isEnabled, onEnabledChange, setEnabled } from "@/lib/settings"

const TEXT = {
  on: { state: "On", hint: "Open buttons on fut.gg cards, and the queue panel in the Web App." },
  off: { state: "Off", hint: "Nothing is added to fut.gg or the Web App. Pages already open follow along." },
}

/** Shows the switch as on or off. The DOM it needs is in popup.html. */
export function paint(doc: Document, on: boolean): void {
  const text = TEXT[on ? "on" : "off"]
  doc.getElementById("toggle")?.setAttribute("aria-checked", String(on))
  doc.body.classList.toggle("is-off", !on)
  const state = doc.getElementById("state")
  if (state) state.textContent = text.state
  const hint = doc.getElementById("hint")
  if (hint) hint.textContent = text.hint
}

export async function start(doc: Document): Promise<void> {
  const version = doc.getElementById("version")
  if (version) version.textContent = `v${chrome.runtime?.getManifest?.().version ?? ""}`

  let on = await isEnabled()
  paint(doc, on)

  doc.getElementById("toggle")?.addEventListener("click", () => {
    on = !on
    paint(doc, on) // the switch answers the click; storage catches up
    setEnabled(on).catch(() => paint(doc, (on = !on))) // couldn't save: snap back rather than lie
  })

  // The switch can also be flipped in another window's popup.
  onEnabledChange((next) => paint(doc, (on = next)))
}

start(document)
