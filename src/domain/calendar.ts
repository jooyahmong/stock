import type { KeywordItem } from '../repo/types'

/**
 * Pure helpers for the monthly Calendar View. No DB, no React. The calendar
 * only *reads* existing KeywordItem data and reshapes it for display — it never
 * merges or mutates the "one row = one keyword" model.
 */

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar date of "now" as YYYY-MM-DD (today is a user-local concept). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Local current month as YYYY-MM. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}`
}

export function formatMonthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

export interface DayCell {
  iso: string
  day: number
  /** false for leading/trailing days borrowed from the adjacent month. */
  inMonth: boolean
}

/** 7-column weeks covering `month` (YYYY-MM), padded to whole weeks. */
export function buildMonthGrid(month: string): DayCell[][] {
  const [y, m] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay() // 0 = Sun
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const cells: DayCell[] = []
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - (firstWeekday - i)))
    cells.push({ iso: isoOf(d), day: d.getUTCDate(), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${y}-${pad(m)}-${pad(d)}`, day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const [ly, lm, ld] = cells[cells.length - 1].iso.split('-').map(Number)
    const nd = new Date(Date.UTC(ly, lm - 1, ld + 1))
    cells.push({ iso: isoOf(nd), day: nd.getUTCDate(), inMonth: false })
  }

  const weeks: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** KeywordItems of `month`, grouped by exact date, each group in sortOrder. */
export function keywordsByDay(
  keywords: KeywordItem[],
  month: string,
): Map<string, KeywordItem[]> {
  const map = new Map<string, KeywordItem[]>()
  const prefix = month + '-'
  for (const k of keywords) {
    if (!k.period.startsWith(prefix) || !DATE_RE.test(k.period)) continue
    const arr = map.get(k.period)
    if (arr) arr.push(k)
    else map.set(k.period, [k])
  }
  for (const arr of map.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)
  return map
}

/** Month (YYYY-MM) of the earliest real date in the plan, or null. */
export function earliestDateMonth(keywords: KeywordItem[]): string | null {
  let min: string | null = null
  for (const k of keywords) {
    if (!DATE_RE.test(k.period)) continue
    if (min === null || k.period < min) min = k.period
  }
  return min ? min.slice(0, 7) : null
}

export type GenMark = 'done' | 'missing' | 'none'

/**
 * O/X rule (spec §4): only past dates get a mark.
 *   past + 생성 true  -> 'done'    (○)
 *   past + 생성 false -> 'missing' (×)
 *   today or future   -> 'none'    (the day isn't over — don't mark misses)
 */
export function genMark(dayIso: string, today: string, generated: boolean): GenMark {
  if (dayIso >= today) return 'none'
  return generated ? 'done' : 'missing'
}

export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month)
}

function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
