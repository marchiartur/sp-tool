// The on/off switch behind the toolbar popup. One key in chrome.storage.local, read by
// everything that puts UI on a page, so switching off reaches pages already open.
//
// background.js can't import this (it's a plain script): it reads the same key by hand.

const KEY = "enabled"

/** Off only if it was switched off: a fresh install, or storage we can't read, is on. */
export async function isEnabled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(KEY)
    return stored[KEY] !== false
  } catch {
    return true
  }
}

export async function setEnabled(on: boolean): Promise<void> {
  await chrome.storage.local.set({ [KEY]: on })
}

/** Runs on every flip of the switch, wherever it came from. Returns an unsubscribe. */
export function onEnabledChange(fn: (on: boolean) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes[KEY]) fn(changes[KEY].newValue !== false)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
