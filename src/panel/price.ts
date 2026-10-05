// EA transfer market price ladder helpers (shared with the extension).
export const MIN_PRICE = 200
export const MAX_PRICE = 15_000_000

export const stepAt = (p: number) =>
  p < 1000 ? 50 : p < 10000 ? 100 : p < 50000 ? 250 : p < 100000 ? 500 : 1000

export const snap = (p: number) =>
  Math.min(MAX_PRICE, Math.max(MIN_PRICE, Math.ceil(p / stepAt(p)) * stepAt(p)))

export const up = (p: number) => snap(p + stepAt(p))
export const down = (p: number) => snap(Math.max(MIN_PRICE, p - stepAt(p - 1)))

export const fmt = (n: number) => n.toLocaleString("en-US")

/** "2600", "2,600", "2.6k", "1.2m" -> number on the ladder, or null */
export function parsePrice(text: string): number | null {
  const m = text.trim().toLowerCase().replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)([km])?$/)
  if (!m) return null
  const n = m[2]
    ? parseFloat(m[1].replace(",", ".")) * (m[2] === "k" ? 1e3 : 1e6)
    : parseInt(m[1].replace(/[.,]/g, ""), 10)
  return Number.isFinite(n) && n > 0 ? snap(n) : null
}
