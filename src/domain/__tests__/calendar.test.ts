import { describe, it, expect } from 'vitest'
import {
  buildMonthGrid,
  currentMonth,
  earliestDateMonth,
  formatMonthTitle,
  genMark,
  keywordsByDay,
  shiftMonth,
  todayIso,
} from '../calendar'
import type { KeywordItem } from '../../repo/types'

function kw(id: string, period: string, keyword: string, sortOrder = 0): KeywordItem {
  return {
    id,
    workspaceId: 'local',
    planId: 'p1',
    period,
    keyword,
    sortOrder,
    createdAt: '',
    updatedAt: '',
  }
}

describe('month math', () => {
  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
    expect(shiftMonth('2027-12', 1)).toBe('2028-01')
    expect(shiftMonth('2027-09', 0)).toBe('2027-09')
    expect(shiftMonth('2027-06', -13)).toBe('2026-05')
  })
  it('formatMonthTitle', () => {
    expect(formatMonthTitle('2027-09')).toBe('September 2027')
    expect(formatMonthTitle('2028-02')).toBe('February 2028')
  })
  it('currentMonth / todayIso use local date shape', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(todayIso(new Date(2027, 8, 5))).toBe('2027-09-05')
    expect(currentMonth(new Date(2027, 8, 5))).toBe('2027-09')
  })
})

describe('buildMonthGrid', () => {
  it('pads to whole weeks and marks the first of month on the right weekday', () => {
    // 2027-09-01 is a Wednesday -> 3 leading days
    const weeks = buildMonthGrid('2027-09')
    const flat = weeks.flat()
    expect(flat.length % 7).toBe(0)
    expect(weeks[0].length).toBe(7)
    const firstInMonth = flat.findIndex((c) => c.inMonth)
    expect(firstInMonth).toBe(3)
    expect(flat[firstInMonth]).toMatchObject({ iso: '2027-09-01', day: 1 })
    expect(flat.slice(0, 3).every((c) => !c.inMonth)).toBe(true)
    expect(flat.filter((c) => c.inMonth).length).toBe(30)
  })

  it('handles leap February (2028) vs common February (2027)', () => {
    expect(buildMonthGrid('2028-02').flat().filter((c) => c.inMonth).length).toBe(29)
    expect(buildMonthGrid('2027-02').flat().filter((c) => c.inMonth).length).toBe(28)
  })

  it('month starting on Sunday has no leading padding', () => {
    // 2027-08-01 is a Sunday
    const flat = buildMonthGrid('2027-08').flat()
    expect(flat[0]).toMatchObject({ iso: '2027-08-01', inMonth: true })
  })
})

describe('keywordsByDay', () => {
  const items = [
    kw('a', '2027-09-01', 'Back to school', 0),
    kw('b', '2027-09-01', 'Family picnic', 1),
    kw('c', '2027-09-01', "Father's Day", 2),
    kw('d', '2027-09-15', 'Chuseok', 0),
    kw('e', '2027-10-01', 'October', 0),
    kw('f', '2027-W37', 'weekly noise', 0),
  ]
  it('groups by exact date within the month, keeps repeats independent, sorts', () => {
    const map = keywordsByDay(items, '2027-09')
    expect([...map.keys()].sort()).toEqual(['2027-09-01', '2027-09-15'])
    expect(map.get('2027-09-01')!.map((k) => k.keyword)).toEqual([
      'Back to school',
      'Family picnic',
      "Father's Day",
    ])
  })
  it('ignores other months and non-date periods', () => {
    const map = keywordsByDay(items, '2027-09')
    expect(map.has('2027-10-01')).toBe(false)
    expect([...map.values()].flat().some((k) => k.period === '2027-W37')).toBe(false)
  })
})

describe('genMark (O/X rule)', () => {
  const today = '2027-09-10'
  it('past + generated -> done (○)', () => {
    expect(genMark('2027-09-09', today, true)).toBe('done')
  })
  it('past + not generated -> missing (×)', () => {
    expect(genMark('2027-09-09', today, false)).toBe('missing')
  })
  it('today -> none regardless of generated', () => {
    expect(genMark(today, today, false)).toBe('none')
    expect(genMark(today, today, true)).toBe('none')
  })
  it('future -> none regardless of generated', () => {
    expect(genMark('2027-09-11', today, false)).toBe('none')
    expect(genMark('2027-12-31', today, true)).toBe('none')
  })
})

describe('earliestDateMonth', () => {
  it('returns the month of the earliest real date, ignoring week/month periods', () => {
    expect(
      earliestDateMonth([
        kw('a', '2027-05-20', 'x'),
        kw('b', '2027-02-02', 'y'),
        kw('c', '2027-W03', 'z'),
      ]),
    ).toBe('2027-02')
    expect(earliestDateMonth([kw('a', '2027-W03', 'z')])).toBeNull()
    expect(earliestDateMonth([])).toBeNull()
  })
})
