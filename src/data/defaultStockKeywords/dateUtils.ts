/** Pure UTC date helpers for seed generation. */

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

/** Every calendar date of `year` as 'YYYY-MM-DD', Jan 1 → Dec 31. */
export function datesOfYear(year: number): string[] {
  const out: string[] = []
  const cur = new Date(Date.UTC(year, 0, 1))
  while (cur.getUTCFullYear() === year) {
    out.push(iso(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate()))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

/** Today's date in the local timezone as 'YYYY-MM-DD'. */
export function todayLocalIso(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** `count` consecutive dates starting at `startIso` (inclusive). */
export function windowDates(startIso: string, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(addDays(startIso, i))
  return out
}

// Non-leap cumulative day counts, so a (month, day) always maps to the same
// slot regardless of year — that's what makes the pack "loop" by month/day.
const MONTH_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

/** Ordinal position of a date within a normal year (1..365), Feb 29 → Feb 28. */
export function ordinalOfDate(isoDate: string): number {
  const [, m, d] = isoDate.split('-').map(Number)
  const day = m === 2 && d === 29 ? 28 : d
  return MONTH_CUMULATIVE[m - 1] + day
}

export function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Production date for a target: `lead` days earlier (~61 ≈ 2 months). */
export function productionFor(targetIso: string, lead: number): string {
  return addDays(targetIso, -lead)
}

/** Nth weekday of a month, e.g. nthWeekday(2027,5,0,2) = 2nd Sunday of May. */
export function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): string {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const shift = (weekday - first.getUTCDay() + 7) % 7
  const day = 1 + shift + (n - 1) * 7
  return iso(year, month, day)
}

/** Western (Gregorian) Easter Sunday via the Anonymous Gregorian algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(year, month, day)
}

/** Lunar New Year (Gregorian date). Small table — extend as needed. */
const LUNAR_NEW_YEAR: Record<number, string> = {
  2025: '2025-01-29',
  2026: '2026-02-17',
  2027: '2027-02-06',
  2028: '2028-01-26',
  2029: '2029-02-13',
  2030: '2030-02-03',
  2031: '2031-01-23',
  2032: '2032-02-11',
}

export function lunarNewYear(year: number): string | null {
  return LUNAR_NEW_YEAR[year] ?? null
}
