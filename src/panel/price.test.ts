import { describe, expect, it } from "vitest"
import { down, fmt, parsePrice, snap, up } from "./price"

describe("parsePrice", () => {
  it.each([
    ["2600", 2600],
    ["2,600", 2600],
    ["2.600", 2600],
    ["2.6k", 2600],
    ["1.2m", 1_200_000],
    ["1,500,000", 1_500_000],
    ["1.500.000", 1_500_000],
    [" 14 250 ", 14_250],
    ["14100", 14_250],
  ])("%s -> %d", (text, value) => expect(parsePrice(text)).toBe(value))

  it.each(["", "abc", "0", "-5", "1,2,3"])("rejects %j", (text) => expect(parsePrice(text)).toBeNull())

  it("reads back every formatted price", () => {
    for (const p of [200, 950, 1000, 14_250, 49_750, 99_500, 1_500_000, 15_000_000]) expect(parsePrice(fmt(p))).toBe(p)
  })
})

describe("price ladder", () => {
  it("snaps up to the next valid price", () => {
    expect(snap(1)).toBe(200)
    expect(snap(1001)).toBe(1100)
    expect(snap(10_001)).toBe(10_250)
    expect(snap(20_000_000)).toBe(15_000_000)
  })

  it("steps across bracket boundaries", () => {
    expect(up(950)).toBe(1000)
    expect(down(1000)).toBe(950)
    expect(up(9900)).toBe(10_000)
    expect(down(10_000)).toBe(9900)
    expect(down(200)).toBe(200)
  })
})
