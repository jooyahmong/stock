import { describe, it, expect } from 'vitest'
import {
  buildDefaultStockPlan,
  buildDefaultStockPlanDetailed,
} from '../buildDefaultStockPlan'
import { addDays, windowDates } from '../dateUtils'
import { PASS_QUALIFIERS as QUALS } from '../pools'

// Fixed start so the suite is deterministic. Real seeding uses today's date.
const START = '2026-09-01'
const rows = buildDefaultStockPlan(START)
const detailed = buildDefaultStockPlanDetailed(START)

function byDate(list: { productionDate: string }[]) {
  const m = new Map<string, number>()
  for (const r of list) m.set(r.productionDate, (m.get(r.productionDate) ?? 0) + 1)
  return m
}

describe('rolling 365-day pack — structure (spec §22)', () => {
  it('covers 365 consecutive days from the start date', () => {
    const have = [...new Set(rows.map((r) => r.productionDate))].sort()
    expect(have).toEqual(windowDates(START, 365))
    expect(have[0]).toBe(START)
    expect(have[have.length - 1]).toBe(addDays(START, 364)) // 2027-08-31
  })

  it('has exactly 2 keywords per day and 730 total', () => {
    for (const [, n] of byDate(rows)) expect(n).toBe(2)
    expect(rows.length).toBe(730)
  })

  it('repeats the same date on two rows (never merged)', () => {
    const first = rows.filter((r) => r.productionDate === START)
    expect(first).toHaveLength(2)
    expect(first[0].productionDate).toBe(first[1].productionDate)
  })

  it('has no empty keywords', () => {
    for (const r of rows) expect(r.keyword.trim().length).toBeGreaterThan(3)
  })

  it('has no exact-duplicate keyword across the whole pack', () => {
    const seen = new Set<string>()
    const dups: string[] = []
    for (const r of rows) {
      const key = r.keyword.trim().toLowerCase()
      if (seen.has(key)) dups.push(r.keyword)
      seen.add(key)
    }
    expect(dups).toEqual([])
  })

  it('the two keywords on a day are not identical', () => {
    for (const date of byDate(rows).keys()) {
      const [a, b] = rows.filter((r) => r.productionDate === date)
      expect(a.keyword).not.toBe(b.keyword)
    }
  })

  it('is deterministic for a given start date', () => {
    expect(buildDefaultStockPlan(START)).toEqual(rows)
  })

  it('loops by (month, day): same calendar day → same content one cycle later', () => {
    // Two windows starting on the same (month, day) a year apart. A non-event
    // day (Oct 5) must get identical keywords — the pack cycles by month/day.
    const a = buildDefaultStockPlan('2026-09-01')
      .filter((r) => r.productionDate === '2026-10-05')
      .map((r) => r.keyword)
    const b = buildDefaultStockPlan('2027-09-01')
      .filter((r) => r.productionDate === '2027-10-05')
      .map((r) => r.keyword)
    expect(a).toHaveLength(2)
    expect(b).toEqual(a)
  })

  it('always yields 365 days / 730 keywords even for a leap-year window', () => {
    const leap = buildDefaultStockPlan('2027-09-01') // window includes 2028-02-29
    expect(new Set(leap.map((r) => r.productionDate)).size).toBe(365)
    expect(leap.length).toBe(730)
    expect(leap.filter((r) => r.productionDate === '2028-02-29')).toHaveLength(2)
  })
})

describe('rolling pack — ~2-month lead & window boundary (spec §16, §22)', () => {
  it("Valentine's Day → 2026-12-01 & 2026-12-14 (before the 2027-02-14 target)", () => {
    const v = detailed.filter((d) => d.event === "Valentine's Day")
    expect([...new Set(v.map((d) => d.productionDate))].sort()).toEqual([
      '2026-12-01',
      '2026-12-14',
    ])
    for (const d of v) {
      expect(d.targetDate).toBe('2027-02-14')
      expect(d.productionDate < '2027-02-14').toBe(true)
    }
  })

  it('Christmas is produced around October (of the same year)', () => {
    const c = detailed.filter((d) => d.event === 'Christmas')
    expect(c.length).toBeGreaterThan(0)
    for (const d of c) expect(d.productionDate.startsWith('2026-10')).toBe(true)
  })

  it('Halloween is produced around August', () => {
    const h = detailed.filter((d) => d.event === 'Halloween')
    expect(h.length).toBeGreaterThan(0)
    // 2026 Halloween prep (Aug 2026) is just before the 2026-09-01 window start,
    // so the in-window occurrence is the 2027 one.
    for (const d of h) expect(d.productionDate.startsWith('2027-08')).toBe(true)
  })

  it("New Year's Day is produced ~2 months early (Oct–Nov of the prior year)", () => {
    const n = detailed.filter((d) => d.event === "New Year's Day")
    expect(n.length).toBeGreaterThan(0)
    for (const d of n) {
      expect(d.productionDate >= '2026-10-10' && d.productionDate <= '2026-11-05').toBe(true)
      expect(d.targetDate).toBe('2027-01-01')
    }
  })

  it('never places an event keyword on its own event day', () => {
    for (const d of detailed) {
      if (d.event && d.targetDate) expect(d.productionDate).not.toBe(d.targetDate)
    }
  })

  it('movable events resolve to real dates (Easter, Thanksgiving)', () => {
    // Easter 2027 = 2027-03-28 → production ~2027-01
    const easter = detailed.filter((d) => d.event === 'Easter')
    expect(easter.some((d) => d.productionDate.startsWith('2027-01'))).toBe(true)
    // Thanksgiving 2026 = 2026-11-26 → production ~2026-09
    const thanks = detailed.filter((d) => d.event === 'Thanksgiving')
    expect(thanks.some((d) => d.productionDate.startsWith('2026-09'))).toBe(true)
  })
})

describe('rolling pack — content mix (spec §8)', () => {
  it('spreads across many categories, none dominating', () => {
    const counts: Record<string, number> = {}
    for (const d of detailed) counts[d.category] = (counts[d.category] ?? 0) + 1
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(7)
    expect(Math.max(...Object.values(counts))).toBeLessThan(detailed.length * 0.45)
  })

  it('keywords are short word-style phrases (2–7 chunks, not sentences)', () => {
    for (const r of rows) {
      const n = r.keyword.trim().split(/\s+/).length
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(7)
    }
    // 서술형(관계절) 종결어미가 없어야 한다
    const narrative = rows.filter((r) => /(하는|하며|있는|같은)\s/.test(r.keyword))
    expect(narrative).toEqual([])
  })

  it('keeps qualifier-suffixed variants to a minority (< 40%)', () => {
    const suffixed = rows.filter((r) => new RegExp(`\\s(${QUALS.join('|')})$`).test(r.keyword))
    expect(suffixed.length / rows.length).toBeLessThan(0.4)
    // and no ugly numeric fallback suffixes
    expect(rows.filter((r) => / \d+$/.test(r.keyword))).toEqual([])
  })

  it('excludes brand / character / celebrity names', () => {
    const banned =
      /\b(disney|pixar|marvel|pokemon|nike|adidas|coca[- ]?cola|starbucks|taylor swift|mickey|batman|iphone|samsung)\b/i
    for (const r of rows) expect(banned.test(r.keyword)).toBe(false)
  })
})
